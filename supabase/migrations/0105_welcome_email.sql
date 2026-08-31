-- 0105 — Welcome email for self-signup buyers and sellers.
--
-- THE GAP
-- Until now the ONLY welcome MangaiMart ever sent was the temp-password mail in
-- api/admin-create-user.js — i.e. only to accounts an admin typed in by hand.
-- Everybody who signed up themselves, which is everybody, got nothing: no
-- confirmation the account exists, no sender address to recognise later, no
-- first touch outside the app. This migration is the database half of closing
-- that; the sending half is the `welcome-email` Edge Function.
--
-- HOW IT FIRES
-- A Supabase Database Webhook on `profiles` INSERT calls the Edge Function.
-- The webhook is configured BY HAND in the dashboard, not created here, and
-- that is deliberate: the trigger has to carry a service-role key in a header,
-- and a secret pasted into a checked-in migration is how the daily report ended
-- up POSTing a literal `<REPORT_TOKEN>` and 401ing in silence for weeks. The
-- dashboard stores it out of the repo. Steps: docs/setup/WELCOME_EMAIL.md.
--
-- WHY `profiles` AND NOT `auth.users`
-- 0028's trigger already writes exactly one profiles row per auth user, for
-- EVERY sign-in method — password, Google, OTP, dashboard-created. Hanging the
-- webhook there means one hook covers all of them and it reads the role, name
-- and email the app actually uses rather than raw signup metadata.
--
-- Additive and idempotent. Requires 0028 (handle_new_user).

-- ── 1) The send marker ───────────────────────────────────────────────────────
--
-- Timestamp, not a boolean, because the useful question when someone says "I
-- never got it" is WHEN we think we sent it, and a boolean cannot answer that.
--
-- It doubles as the idempotency lock. The Edge Function claims a row with a
-- guarded `update … where welcome_email_sent_at is null` and only sends if that
-- update touched a row, so a delivery that arrives twice — a hook configured
-- twice, a manual resend, a restore replaying inserts — cannot mail the same
-- person twice. (Database Webhooks run on pg_net and are NOT retried
-- automatically, so this is not defending against a retry storm; it is cheap
-- insurance against the repeats that do happen.)
--
-- Because nothing retries on its own, a failed send RELEASES the claim: the
-- function sets it back to null so the row is left looking owed. That is what
-- makes `welcome_email_sent_at is null` on an old profile a usable queue rather
-- than a mystery — see the Verify block at the foot of this file.
--
-- The same is true of the window between applying THIS migration and creating
-- the webhook in the dashboard: signups in that gap land with NULL, show up in
-- that queue, and can be drained by hand. Nothing is lost by applying the SQL
-- first, which is why the setup doc tells you to.
alter table profiles
  add column if not exists welcome_email_sent_at timestamptz;

comment on column profiles.welcome_email_sent_at is
  'When the welcome email was sent, and the idempotency lock for sending it. NULL = still owed one. Pre-stamped at signup for accounts that must never get it: admin-created users (they get the temp-password welcome instead) and anonymous guest sessions (no address). Claimed by the welcome-email Edge Function.';

-- ── 2) Do not mail the entire existing user base ─────────────────────────────
--
-- The webhook only fires on INSERT, so today's rows would never trigger it on
-- their own. This is the belt to that braces: it makes "already handled"
-- explicit in the data, so a manual backfill call, a restore, or a future
-- catch-up job cannot decide that every buyer since launch is owed a welcome.
--
-- The age guard is what makes this safe to re-run. Without it, applying the
-- migration a second time would stamp — and therefore silently cancel — the
-- welcome owed to anyone who signed up in the seconds before it ran. An hour is
-- far longer than the webhook takes (it fires on commit and sends in about a
-- second), so nothing still legitimately pending is ever old enough to be
-- caught by it.
update profiles
   set welcome_email_sent_at = now()
 where welcome_email_sent_at is null
   and created_at < now() - interval '1 hour';

-- ── 3) Accounts that must never get the self-signup welcome ──────────────────
--
-- Two exclusions, both stamped at INSERT time so the webhook fires, finds the
-- row already claimed, and exits without sending:
--
--   • Admin-created users. api/admin-create-user.js already sends them a
--     welcome carrying a temporary password; a second, passwordless "welcome"
--     arriving beside it reads as a phishing attempt. It now tags the signup
--     metadata with `created_by_admin` so this trigger can tell the two apart.
--     Note the tag is in `raw_user_meta_data`, which a user CAN set on their own
--     signup — the consequence of forging it is not receiving an email, so
--     there is nothing to gain and no check worth the complexity.
--
--   • Anonymous guest sessions. `is_anonymous` users have no email address at
--     all; without this the function would be woken for every guest who opens
--     the storefront, only to skip.
--
-- Everything else in this function is unchanged from 0028 — reproduced in full
-- because `create or replace` has no way to patch one branch.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public as $$
declare
  meta_role text := new.raw_user_meta_data->>'role';
  is_guest boolean := coalesce(new.is_anonymous, false);
  by_admin boolean := coalesce(new.raw_user_meta_data->>'created_by_admin', '') = 'true';
begin
  insert into public.profiles (id, role, full_name, email, city, welcome_email_sent_at)
  values (
    new.id,
    -- Only buyer/seller may be seeded from signup metadata; admin is never
    -- self-assignable (mirrors the guard trigger in migration 0010).
    case when meta_role in ('buyer','seller') then meta_role else 'buyer' end,
    coalesce(
      nullif(new.raw_user_meta_data->>'full_name', ''),
      case when is_guest then 'Customer' else 'New user' end
    ),
    new.email,
    nullif(new.raw_user_meta_data->>'city', ''),
    -- NULL = owed a welcome. now() = pre-claimed, never send one.
    case when is_guest or by_admin or new.email is null then now() else null end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Verify ───────────────────────────────────────────────────────────────────
--   select count(*) from profiles
--    where welcome_email_sent_at is null and created_at < now() - interval '1 hour';
--     -- expect 0, always. A non-zero count means the webhook is not reaching the
--     -- Edge Function, or the function is claiming rows and then failing to send.
--
--   select id, email, role, created_at from profiles
--    where welcome_email_sent_at is null order by created_at desc;
--     -- the live queue: signups still waiting. Should drain within seconds.
