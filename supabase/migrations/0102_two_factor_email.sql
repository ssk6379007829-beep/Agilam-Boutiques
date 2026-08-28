-- 0102 — Email code as a second two-factor method, alongside the app.
--
-- 0099 enrolled TOTP, 0100 made `is_admin()` / `is_staff()` demand `aal2`. This
-- adds a second method a user may choose INSTEAD of an authenticator app: a
-- six-digit code emailed to a security address they register and prove.
--
-- ── THE PROBLEM THIS HAS TO SOLVE ───────────────────────────────────────────
--
-- GoTrue has no email factor. It mints `aal2` for a TOTP (or phone) challenge
-- and for nothing else, so an emailed code can NEVER move the JWT's `aal` claim.
-- After 0100 the console's ~72 policy clauses are gated on `aal2`, which means
-- an email-only account would sign in, see every screen load empty, and have no
-- way to tell that apart from an outage.
--
-- The answer is not to check the code in React — that is the padlock-with-no-
-- wall the 0099/0100 doc argues against at length, and it would be worse here
-- because the whole point of 0100 was to move the decision into Postgres.
--
-- Instead the verification is recorded server-side, by the service role, against
-- the **`session_id` claim of the very JWT that will use it**, and `is_admin()`
-- / `is_staff()` are widened to accept it. The database still decides. What
-- changes is that there are now two ways to satisfy it:
--
--     aal2 in the token          (GoTrue verified an authenticator)
--   OR a live row in mfa_email_sessions for THIS session_id
--                                (we verified an emailed code for this session)
--
-- Binding to `session_id` rather than to `user_id` is what keeps this honest. A
-- stolen password opens a DIFFERENT session with a different `session_id`, so
-- one person's verified session grants that person's browser nothing anywhere
-- else. Sign out and the row is orphaned; the next sign-in asks again.
--
-- ── HOW STRONG IS IT, HONESTLY ──────────────────────────────────────────────
--
-- Weaker than TOTP, and knowingly so. It is a real second factor — the code
-- travels to an inbox, not to the browser holding the password — but an inbox
-- is a softer secret than a device, and it is reachable by forwarding rules and
-- by the mail provider. Two things narrow that:
--
--   • The security address must DIFFER from the account's login email. Console
--     accounts sign in with email + password and reset that password by email;
--     sending the second factor to the same inbox would collapse both factors
--     into one and would have been security theatre with extra steps. Enforced
--     in the Edge Function AND in `mfa_email_challenge_create` below, because a
--     rule that only the caller enforces is a rule one refactor from gone.
--   • Changing the address requires an ALREADY-verified session. So the first
--     registration is protected by "can you read this inbox", and every change
--     after it by "and are you already through the door".
--
-- ── WHAT UN-DOES THIS SILENTLY ──────────────────────────────────────────────
--
-- Re-running 0100 after this. 0100's `create or replace` restores the aal2-only
-- bodies, and every email-verified admin is locked out with no error message —
-- the mirror image of 0100's own warning about `supabase db push` replaying
-- `schema.sql`. If you ever re-apply 0100, re-apply 0102 straight after.
--
-- Check which one is live:
--   select prosrc from pg_proc where proname in ('is_admin','is_staff');
-- The 0102 bodies mention `mfa_email_sessions`. The 0100 ones do not.
--
-- Idempotent. Safe to re-run.
--
-- ROLLBACK (removes the email path, leaves TOTP working) — re-apply 0100, then:
--   drop function if exists mfa_email_status();
--   drop function if exists mfa_email_challenge_create(uuid, text, text, uuid, text);
--   drop function if exists mfa_email_challenge_consume(uuid, text, uuid);
--   drop function if exists mfa_email_challenges_prune();
--   drop function if exists mfa_email_factor_clear(uuid);
--   drop table if exists mfa_email_challenges;
--   drop table if exists mfa_email_sessions;
--   drop table if exists mfa_email_factors;

-- == 0) PRE-FLIGHT ============================================================
--
-- 0099 owns `mfa_hash_code`, which this migration reuses so the two code stores
-- cannot drift on hashing. Applying 0102 onto a database that never got 0099
-- would half-create a scheme and fail later, at a worse moment.

do $$
begin
  if to_regprocedure('public.mfa_hash_code(text)') is null then
    raise exception '0102 requires 0099 (mfa_hash_code is missing). Apply 0099 and 0100 first.'
      using errcode = 'check_violation';
  end if;
end $$;

-- == 1) THE REGISTERED ADDRESS ================================================
--
-- One security address per account. Not a list: every extra inbox is another
-- way in, and the recovery story for "I lost access to my second email" is
-- already covered by backup codes and by an admin reset.
--
-- A row only appears here once the address has been PROVED — the pending one
-- lives on the challenge row until then, and `mfa_email_challenge_create`
-- explains why that matters. `verified_at` is therefore effectively always set;
-- it stays nullable, and every read below insists on `verified_at is not null`,
-- so that a future half-written row can never be mistaken for a working factor.

create table if not exists mfa_email_factors (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  verified_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- == 2) THE SESSION LEDGER ====================================================
--
-- One row per session that has passed an email challenge. This is the table
-- `is_admin()` consults, so it is the load-bearing one.
--
-- `session_id` is the primary key, not `user_id`: the same account signed in on
-- a phone and a laptop is two sessions, and verifying one must not verify the
-- other. There is deliberately no expiry column — the answer to "how long does
-- one code keep the console open" is "until sign-out", matching TOTP exactly
-- (Supabase keeps an aal2 session across refreshes and reboots too). Sessions
-- themselves expire; when GoTrue drops one, its `session_id` never appears in a
-- JWT again and this row is inert.

create table if not exists mfa_email_sessions (
  session_id  uuid primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  verified_at timestamptz not null default now()
);

create index if not exists mfa_email_sessions_user_idx on mfa_email_sessions (user_id);

-- == 3) CODES IN FLIGHT =======================================================
--
-- Stored as sha256 through 0099's `mfa_hash_code`, never in clear. A six-digit
-- code is 20 bits — trivially guessable if you let someone guess — so unlike
-- the 64-bit backup codes this table MUST carry its own limits, and it does:
-- `attempts` caps guessing, `expires_at` caps the window, and
-- `mfa_email_challenge_create` caps how many can be requested per hour.
--
-- `purpose` separates the two flows because they end differently: an 'enroll'
-- code marks the address verified as well as the session, a 'challenge' code
-- only the session.
--
-- `session_id` is captured at CREATE time, not at consume time. That closes a
-- small but real hole: otherwise a code mailed to the owner could be typed into
-- an attacker's session and would verify the attacker's browser instead.

create table if not exists mfa_email_challenges (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  email      text not null,
  code_hash  text not null,
  purpose    text not null check (purpose in ('enroll', 'challenge')),
  session_id uuid,
  attempts   smallint not null default 0,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists mfa_email_challenges_user_idx
  on mfa_email_challenges (user_id, created_at desc);

-- == 4) NOBODY READS THESE FROM A BROWSER =====================================
--
-- The same posture 0099 takes with `mfa_backup_codes`: RLS on, no policy, no
-- grant — not even to the owner of the row. RLS with no permissive policy
-- denies everything, which is the intent. Every legitimate read happens inside
-- a `security definer` function below, and every write happens as `service_role`
-- from the `mfa-recovery` Edge Function.
--
-- The explicit revokes matter as much as the missing grants: a future
-- `grant ... on all tables in schema public` would otherwise hand `authenticated`
-- the challenge table, which is an oracle for other people's codes and a
-- writeable path into `mfa_email_sessions` — i.e. a way to self-verify without
-- ever receiving an email. That would undo the entire migration in one line.

alter table mfa_email_factors    enable row level security;
alter table mfa_email_sessions   enable row level security;
alter table mfa_email_challenges enable row level security;

revoke all on table mfa_email_factors    from public, anon, authenticated;
revoke all on table mfa_email_sessions   from public, anon, authenticated;
revoke all on table mfa_email_challenges from public, anon, authenticated;

-- == 5) THE ENFORCEMENT CHANGE ================================================
--
-- 0100's bodies, plus one alternative branch. Everything 0100 says about these
-- two functions still applies and is restated rather than referenced, because
-- the next person to read `prosrc` in a production incident will see this text
-- and nothing else.
--
-- The assurance level and the session id are both read INLINE from
-- `request.jwt.claims` rather than through the `mfa_aal()` / `mfa_verified()`
-- helpers. That is 0087's lesson: Postgres checks EXECUTE on every function a
-- policy touches BEFORE it tests a single row, so a helper the caller cannot
-- execute fails the whole read `42501` instead of returning fewer rows.
-- `is_admin()` is reachable from policies `anon` evaluates (`profiles: self
-- select` among them), and `mfa_verified()` is revoked from anon.
-- `current_setting` is callable by every role.
--
-- The new table reads are safe for the same reason by a different route: these
-- functions are `security definer`, so the tables are read as the owner and the
-- `revoke all` above is not in the path. A definer function reading a table is
-- not the failure mode 0087 was about; a policy calling a function the caller
-- cannot execute is.
--
-- `s.session_id::text = <claim>` compares as text on purpose. Casting the claim
-- to uuid would raise `22P02` on a malformed token instead of simply not
-- matching, and an exception inside `is_admin()` is a broken console, not a
-- denied row.

create or replace function is_admin() returns boolean
language sql stable security definer
set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin')
     and (
       -- (a) an authenticator app: GoTrue re-minted the token as aal2
       coalesce(
         nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'aal',
         'aal1'
       ) = 'aal2'
       -- (b) an emailed code, verified for THIS session by the service role.
       --     The join to mfa_email_factors is what makes removing the address
       --     (or an admin reset) end every session it had verified, rather than
       --     leaving live rows behind pointing at a factor that no longer exists.
       or exists (
         select 1
           from mfa_email_sessions s
           join mfa_email_factors f
             on f.user_id = s.user_id and f.verified_at is not null
          where s.user_id = auth.uid()
            and s.session_id::text =
                (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'session_id')
       )
     );
$$;

create or replace function is_staff() returns boolean
language sql stable security definer
set search_path = public as $$
  -- Admins are staff for every purpose, so a policy written as `is_staff()`
  -- never has to be written as `is_staff() or is_admin()`. Unlike is_admin(),
  -- this also insists the account is live: a suspended or soft-deleted employee
  -- loses console access the moment the row is updated. Both of those are
  -- 0086's behaviour, carried forward unchanged.
  select exists (
    select 1 from profiles
     where id = auth.uid()
       and role in ('admin', 'staff')
       and coalesce(status, 'active') = 'active'
       and deleted_at is null
  )
  and (
    coalesce(
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'aal',
      'aal1'
    ) = 'aal2'
    or exists (
      select 1
        from mfa_email_sessions s
        join mfa_email_factors f
          on f.user_id = s.user_id and f.verified_at is not null
       where s.user_id = auth.uid()
         and s.session_id::text =
             (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'session_id')
    )
  );
$$;

-- 0086's grants, restated because `create or replace` on a function does not
-- reset them but a future `drop`/`create` would, and because leaving them
-- implicit is how 0087 happened.
revoke all on function is_staff() from public, anon;
grant execute on function is_staff() to authenticated;

-- == 6) THE SAME WIDENING FOR THE HELPERS =====================================
--
-- `mfa_verified()` is not used by any policy — 0100 inlined precisely so that it
-- would not be — but it IS the gate on `mfa_backup_codes_generate()`. Left at
-- aal2-only, an account whose single factor is email could never mint backup
-- codes, i.e. the users with the weaker factor would be the only ones with no
-- recovery path. Widening it here keeps that from being true.
--
-- Keep this one out of policies. It is revoked from anon, and 0087 is what
-- happens when a policy calls something anon cannot execute.

create or replace function mfa_verified() returns boolean
language sql stable security definer
set search_path = public as $$
  select coalesce(
           nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'aal',
           'aal1'
         ) = 'aal2'
      or exists (
         select 1
           from mfa_email_sessions s
           join mfa_email_factors f
             on f.user_id = s.user_id and f.verified_at is not null
          where s.user_id = auth.uid()
            and s.session_id::text =
                (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'session_id')
      );
$$;

revoke all on function mfa_verified() from public, anon;
grant execute on function mfa_verified() to authenticated;

-- == 7) WHAT THE BROWSER MAY ASK =============================================
--
-- The client needs three facts to draw the right screen: is an address
-- registered, is it verified, and is THIS session already through. It gets
-- exactly those, for its own account only.
--
-- The address is returned in full rather than masked. It is the caller's own,
-- they typed it, and a masked one would make "is this the old address or the
-- new one" unanswerable on the screen where they change it.
--
-- Granted to `authenticated` rather than guarded on `is_admin()`, for 0099's
-- reason: `is_admin()` now requires a completed challenge, so a function needed
-- BY the challenge screen must not depend on having completed one.

create or replace function mfa_email_status()
returns table (email text, verified boolean, session_verified boolean)
language sql security definer stable
set search_path = public as $$
  select f.email,
         f.verified_at is not null,
         exists (
           select 1 from mfa_email_sessions s
            where s.user_id = f.user_id
              and s.session_id::text =
                  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'session_id')
         )
    from mfa_email_factors f
   where f.user_id = auth.uid();
$$;

revoke all on function mfa_email_status() from public, anon;
grant execute on function mfa_email_status() to authenticated;

-- == 8) ISSUING A CODE ========================================================
--
-- Service-role only, and it takes `p_user` rather than reading `auth.uid()` —
-- the same shape as 0099's `mfa_backup_code_consume`, for the same reason. The
-- Edge Function calls it with the id it decoded from the caller's own token;
-- letting a browser reach this would be a way to mail codes at other people.
--
-- Returns the challenge id, or raises. The raises are the rate limits, and they
-- are here rather than in TypeScript so that they hold even if a second caller
-- is ever written:
--
--   • 60 seconds between sends. Stops the resend button being a mail bomb.
--   • 6 sends per hour per account. Stops the same thing done patiently.
--   • The address may not be the account's login email (see the header).
--
-- Creating a challenge invalidates the ones before it. Two live codes for one
-- account doubles the guessing surface for no benefit — the user is looking at
-- the newest mail.
--
-- The code itself is generated by the CALLER, in the Edge Function, and only its
-- hash is passed here. That is deliberate: the mailer needs the clear text and
-- nothing else does, so it never crosses the database boundary in either
-- direction and cannot turn up in a PostgREST log or a slow-query trace. This
-- function's job is the parts that must not be re-implementable — the rate
-- limits, the login-address rule, the hashing.

create or replace function mfa_email_challenge_create(
  p_user    uuid,
  p_email   text,
  p_purpose text,
  p_session uuid,
  p_code    text
) returns uuid
language plpgsql security definer
set search_path = public as $$
declare
  v_email  text := lower(trim(coalesce(p_email, '')));
  v_login  text;
  v_recent int;
  v_last   timestamptz;
  v_id     uuid;
begin
  if p_user is null then
    raise exception 'Sign in first.' using errcode = 'insufficient_privilege';
  end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'That does not look like an email address.' using errcode = 'check_violation';
  end if;
  if p_purpose not in ('enroll', 'challenge') then
    raise exception 'Unknown purpose.' using errcode = 'check_violation';
  end if;
  if p_code !~ '^[0-9]{6}$' then
    raise exception 'Malformed code.' using errcode = 'check_violation';
  end if;

  -- The login address is fetched from auth.users, not passed in. A caller that
  -- supplies both values could supply them inconsistently.
  select lower(u.email) into v_login from auth.users u where u.id = p_user;
  if v_login is not null and v_email = v_login then
    raise exception 'Use an address other than the one you sign in with — a reset link and a security code arriving in the same inbox is one factor, not two.'
      using errcode = 'check_violation';
  end if;

  select count(*), max(created_at) into v_recent, v_last
    from mfa_email_challenges
   where user_id = p_user and created_at > now() - interval '1 hour';

  if v_last is not null and v_last > now() - interval '60 seconds' then
    -- No errcode: PL/pgSQL's default P0001 carries the message, and there is
    -- no SQLSTATE that means 'rate limited'. Borrowing an unrelated one would
    -- only mislead whoever next reads a log line.
    raise exception 'A code was just sent. Wait a minute before asking for another.';
  end if;
  if v_recent >= 6 then
    raise exception 'Too many codes requested. Try again in an hour, or use a backup code.';
  end if;

  update mfa_email_challenges
     set consumed_at = now()
   where user_id = p_user and consumed_at is null;

  -- The pending address lives on the CHALLENGE row and nowhere else until the
  -- code comes back. `mfa_email_factors` is deliberately left alone here.
  --
  -- The earlier draft parked the new address on the factor row with
  -- `verified_at` nulled, and it was a trap: `is_admin()` insists on
  -- `verified_at is not null`, so for an account whose only factor is email,
  -- merely ASKING to change the address emptied the console behind the dialog
  -- doing the asking. Consume writes the factor, once, when the address has
  -- actually been proved.
  insert into mfa_email_challenges (user_id, email, code_hash, purpose, session_id, expires_at)
  values (p_user, v_email, mfa_hash_code(p_code), p_purpose, p_session, now() + interval '10 minutes')
  returning id into v_id;

  return v_id;
end $$;

revoke all on function mfa_email_challenge_create(uuid, text, text, uuid, text)
  from public, anon, authenticated;

-- == 9) SPENDING A CODE =======================================================
--
-- Reports a status string rather than a boolean because the screen genuinely
-- needs to tell "wrong code" from "expired" from "locked" — those lead to three
-- different next actions (retype, resend, wait). That is a different judgement
-- from 0099's backup codes, where the distinctions only helped an attacker;
-- here the honest failure modes are ones the owner hits routinely.
--
--   ok       verified; the session row is written
--   invalid  wrong code (attempt counted)
--   expired  older than ten minutes, or already spent
--   locked   five wrong attempts on this challenge
--   none     no code was ever requested
--
-- `p_session` is checked against the session captured at create time. A code
-- mailed to the owner cannot be typed into a different browser's session.

create or replace function mfa_email_challenge_consume(
  p_user    uuid,
  p_code    text,
  p_session uuid
) returns text
language plpgsql security definer
set search_path = public as $$
declare
  v_row mfa_email_challenges%rowtype;
begin
  if p_user is null then
    raise exception 'Sign in first.' using errcode = 'insufficient_privilege';
  end if;

  select * into v_row
    from mfa_email_challenges
   where user_id = p_user and consumed_at is null
   order by created_at desc
   for update skip locked
   limit 1;

  if not found then return 'none'; end if;
  if v_row.expires_at <= now() then return 'expired'; end if;
  if v_row.attempts >= 5 then return 'locked'; end if;

  -- A session mismatch is reported as `invalid` and costs an attempt. Saying
  -- "that code belongs to another session" would confirm to an attacker that
  -- they had guessed a real code.
  if v_row.code_hash <> mfa_hash_code(p_code)
     or (v_row.session_id is not null and p_session is distinct from v_row.session_id) then
    update mfa_email_challenges set attempts = attempts + 1 where id = v_row.id;
    return case when v_row.attempts + 1 >= 5 then 'locked' else 'invalid' end;
  end if;

  update mfa_email_challenges set consumed_at = now() where id = v_row.id;

  if v_row.purpose = 'enroll' then
    insert into mfa_email_factors (user_id, email, verified_at, updated_at)
    values (p_user, v_row.email, now(), now())
    on conflict (user_id) do update
      set email = excluded.email, verified_at = now(), updated_at = now();

    -- Changing the address ends every session the OLD address had verified.
    -- Otherwise a stolen session could repoint the factor at an attacker inbox
    -- and keep its own access alive at the same time.
    delete from mfa_email_sessions where user_id = p_user;
  end if;

  if p_session is not null then
    insert into mfa_email_sessions (session_id, user_id)
    values (p_session, p_user)
    on conflict (session_id) do update set verified_at = now();
  end if;

  return 'ok';
end $$;

revoke all on function mfa_email_challenge_consume(uuid, text, uuid)
  from public, anon, authenticated;

-- == 10) CLEARING THE FACTOR ==================================================
--
-- Used by `mfa-recovery` for all three paths that end a factor: the user drops
-- their email method from the Security card, a backup code is redeemed, or an
-- admin resets somebody. Dropping the sessions along with the row is the part
-- that matters — leaving them would keep every already-open console open.

create or replace function mfa_email_factor_clear(p_user uuid) returns integer
language plpgsql security definer
set search_path = public as $$
declare
  v_removed integer;
begin
  delete from mfa_email_sessions where user_id = p_user;
  delete from mfa_email_challenges where user_id = p_user;
  delete from mfa_email_factors where user_id = p_user;
  get diagnostics v_removed = row_count;
  return v_removed;
end $$;

revoke all on function mfa_email_factor_clear(uuid) from public, anon, authenticated;

-- == 11) WHO HAS ENROLLED, INCLUDING BY EMAIL ================================
--
-- 0099's `mfa_enrollment_status()` reads `auth.mfa_factors`, so after this
-- migration it would report an email-only admin as having no 2FA — and the
-- admin Users page would offer a "reset 2FA" on an account it believed had
-- none. Union the two sources so the one screen that answers "is this person
-- protected" keeps answering it correctly.
--
-- Return type is unchanged (user_id, verified_at), so nothing that calls it
-- needs to change. 0100's pre-flight check reads it too.

create or replace function mfa_enrollment_status()
returns table (user_id uuid, verified_at timestamptz)
language sql security definer stable
set search_path = public as $$
  select x.user_id, min(x.verified_at) as verified_at
    from (
      select f.user_id, f.updated_at as verified_at
        from auth.mfa_factors f
       where f.status = 'verified'
      union all
      select e.user_id, e.verified_at
        from mfa_email_factors e
       where e.verified_at is not null
    ) x
   group by x.user_id
$$;

revoke all on function mfa_enrollment_status() from public, anon, authenticated;
grant execute on function mfa_enrollment_status() to authenticated;

-- == 12) HOUSEKEEPING =========================================================
--
-- Spent and expired challenges are dead weight with a hash in them. Nothing
-- schedules this; it is here so a future pg_cron entry has something to call,
-- and so the table can be swept by hand.

create or replace function mfa_email_challenges_prune() returns integer
language plpgsql security definer
set search_path = public as $$
declare
  v_n integer;
begin
  delete from mfa_email_challenges
   where created_at < now() - interval '7 days';
  get diagnostics v_n = row_count;
  return v_n;
end $$;

revoke all on function mfa_email_challenges_prune() from public, anon, authenticated;
