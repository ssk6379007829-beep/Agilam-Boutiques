-- 0109 — notifications for hand-picked people, and a tappable destination
--
-- Two changes to the notification bell, both driven by the Broadcast page now
-- being one composer instead of two tabs:
--
--   1. `notify_users` — send to a named list of people, the way hand-picked
--      email already works. `broadcast_notification` fans out by ROLE and raises
--      on any other audience, so "Specific people" could email but never notify.
--   2. `broadcast_notification` gains `p_link`, so a broadcast can be tappable
--      the same way an email carries a button.
--
-- ⚠ THE BODY BELOW IS THE LIVE DEFINITION, read out of pg_proc on 2026-09-04,
-- not a copy from an earlier migration file. 0050's audience guard, 0086's
-- is_staff() gate and 0044's type constraint are all reproduced exactly as they
-- run today; the only new thing is the link. Re-deriving this from 0050 or 0086
-- would have quietly reverted whichever of them landed later.

-- ── 1. broadcast_notification, plus a link ──────────────────────────────────
--
-- Dropped and recreated rather than adding a defaulted 4th argument beside the
-- existing 3-argument version. Two overloads where the longer one has a default
-- make a 3-argument call AMBIGUOUS (42725) — which would break every bell send
-- in the app, including the mirror inside the broadcast-email Edge Function.
-- Callers still pass three named arguments and get p_link = null.

drop function if exists broadcast_notification(text, text, text);

create or replace function broadcast_notification(
  p_audience text,
  p_title text,
  p_body text,
  p_link text default null
) returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  n integer;
begin
  -- Widened by 0086: staff send buyer updates, that is part of their job.
  if not is_staff() then
    raise exception 'not authorized';
  end if;
  if coalesce(trim(p_title), '') = '' or coalesce(trim(p_body), '') = '' then
    raise exception 'title and body are required';
  end if;
  -- 0050. Without this an unknown audience silently matched nobody and the
  -- console reported a successful send of zero notifications.
  if p_audience not in ('all', 'buyer', 'seller') then
    raise exception 'unknown audience: %', p_audience;
  end if;

  -- Type must be one of the values allowed by notifications_type_check
  -- (Orders / Messages / Updates / Wishlist, migration 0044). A broadcast is a
  -- platform Update, which slots straight into the buyer's existing feed.
  --
  -- `link` takes a same-origin path or nothing. The pattern is the server-side
  -- half of the guard NotificationsInbox already applies on the way out
  -- (`/^\/[^/]/`): one leading slash, so a stored value can never become an
  -- off-site redirect or a protocol-relative `//evil.example`. An absolute
  -- https:// button URL therefore lands as a plain, untappable notification
  -- rather than a link that goes nowhere.
  insert into notifications (profile_id, type, title, body, link)
  select p.id, 'Updates', p_title, p_body,
         case when p_link ~ '^/[^/]' then p_link else null end
  from profiles p
  where p.deleted_at is null
    -- 0050: the audience is the marketplace, never the people running it.
    and p.role in ('buyer', 'seller')
    and (p_audience = 'all' or p.role = p_audience);

  get diagnostics n = row_count;
  return n;
end;
$$;

-- ⚠ A dropped function takes its grants with it, and a freshly created one is
-- EXECUTE to PUBLIC by default — which would hand this to `anon`. The live ACL
-- before this migration was authenticated + service_role only. Restore exactly
-- that, revoke first.
revoke all on function broadcast_notification(text, text, text, text) from public;
grant execute on function broadcast_notification(text, text, text, text) to authenticated, service_role;

-- ── 2. notify_users — the bell for a named list ─────────────────────────────

create or replace function notify_users(
  p_user_ids uuid[],
  p_title text,
  p_body text,
  p_link text default null
) returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  n integer;
  v_count integer;
begin
  -- Same gate as broadcast_notification. is_staff() is true for admin and staff,
  -- and carries the live-account and verified-session checks with it.
  if not is_staff() then
    raise exception 'not authorized';
  end if;
  if coalesce(trim(p_title), '') = '' or coalesce(trim(p_body), '') = '' then
    raise exception 'title and body are required';
  end if;

  v_count := coalesce(array_length(p_user_ids, 1), 0);
  if v_count = 0 then
    raise exception 'pick at least one person';
  end if;
  -- The cap the hand-picked EMAIL path already carries, restated here so one
  -- picked list behaves the same on both channels. Anything longer is a role
  -- blast wearing a disguise, and a role blast belongs in
  -- broadcast_notification, where 0050's rule and the console's reach count
  -- both apply to it.
  if v_count > 50 then
    raise exception 'pick 50 people or fewer';
  end if;

  -- Deliberately NOT filtered by role, which is the one place this parts company
  -- with broadcast_notification. 0050 restricts who a BLAST may reach — the
  -- marketplace, never the people running it — because "everyone" should never
  -- quietly include your own staff. Naming four people is a different act, and
  -- the email side has always allowed picking a colleague for exactly that
  -- reason. Soft-deleted rows are still excluded: a deleted account has no
  -- inbox anyone will read.
  --
  -- Silently skipping an id that does not resolve is intentional. The count
  -- comes back to the caller, so a picked list that has since lost someone
  -- reports fewer sent rather than failing the whole send.
  insert into notifications (profile_id, type, title, body, link)
  select p.id, 'Updates', p_title, p_body,
         case when p_link ~ '^/[^/]' then p_link else null end
    from profiles p
   where p.id = any (p_user_ids)
     and p.deleted_at is null;

  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function notify_users(uuid[], text, text, text) from public;
grant execute on function notify_users(uuid[], text, text, text) to authenticated, service_role;

comment on function notify_users(uuid[], text, text, text) is
  'Notification bell for a hand-picked list, capped at 50. Unlike broadcast_notification it does not filter by role: 0050 restricts blasts, not named recipients. Added in 0109.';

-- Verify:
--   select proname, pg_get_function_identity_arguments(oid), proacl
--     from pg_proc where proname in ('broadcast_notification','notify_users');
--   -- expect: broadcast_notification(text,text,text,text) and notify_users(...),
--   --         both with authenticated=X and service_role=X, and NO anon.
