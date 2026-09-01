-- Persisted visit history for the admin console's "Visitors" screen.
--
-- ── Why a table at all ──────────────────────────────────────────────────────
-- The console already shows who is on the site RIGHT NOW: PresenceTracker
-- broadcasts every open tab onto one Realtime channel and LivePresence renders
-- the roster (src/lib/presence.ts). That design is deliberately ephemeral — a
-- closed tab clears itself, no cron, no stale "online" rows — and its cost is
-- that nothing survives the visit. Close the tab and the session never existed:
-- no "how many people came yesterday", no "how long did they stay", no "which
-- product held them for four minutes".
--
-- This file adds the memory, WITHOUT touching presence. Realtime stays the
-- source of truth for "now"; these two tables are the source of truth for
-- "before". They cannot contradict each other because the live panel does not
-- read them.
--
-- ── Shape ───────────────────────────────────────────────────────────────────
--   site_visits        one row per TAB (a session). Who, from where, when they
--                      landed, when they were last seen, how many pages.
--   site_visit_pages   one row per page WITHIN that visit, with the dwell time.
--                      This is what answers "time spent per page".
--
-- Duration is derived, never stored: last_seen_at - started_at for a visit,
-- left_at - entered_at for a page. Storing a duration would mean rewriting it
-- on every heartbeat and having it disagree with the timestamps that produced
-- it.
--
-- ── Writes go through ONE function, never through the tables ────────────────
-- Anonymous shoppers are the majority of traffic and they must be recorded, so
-- the writer has to be reachable by anon. Granting anon INSERT/UPDATE on the
-- tables themselves would let anyone holding the anon key that ships in the
-- browser bundle write arbitrary visit rows — including rows attributed to
-- someone else's user_id. Instead both tables are RLS-enabled with NO write
-- policy at all, and every write goes through track_visit(), a SECURITY
-- DEFINER function that decides for itself what gets stored: it stamps
-- auth.uid() from the JWT rather than trusting a parameter, and it refuses to
-- touch a visit row whose visitor_id does not match the caller's (see the
-- anti-hijack clause on the upsert).
--
-- Reads are admin-only, and use is_admin() rather than is_staff() on purpose:
-- this is marketplace analytics, the same class of data as Overview, which
-- migration 0086 already keeps away from employees. It is also the safe helper
-- — is_staff() is revoked from anon, and a policy calling it without a
-- `to authenticated` clause fails the entire read with 42501 (see 0086/0087).
--
-- Idempotent: re-runnable in the Supabase SQL editor.

-- ── Tables ──────────────────────────────────────────────────────────────────

create table if not exists public.site_visits (
  -- The tab's own id, generated in the browser (the same value presence uses
  -- as its channel key), so the client can keep upserting the visit it started
  -- without a round trip to learn a server-assigned id.
  id           uuid primary key,
  -- Stable per-BROWSER id, kept in localStorage. This is what separates
  -- "40 visits" from "40 visitors", and the only thing that makes a returning
  -- shopper visible at all.
  visitor_id   text not null,
  -- Stamped from the JWT, never from a parameter. Null for a guest.
  user_id      uuid references profiles(id) on delete set null,
  role         text not null default 'guest',
  -- Display name AS IT WAS during the visit. Deliberately denormalised: a
  -- guest has no profile to join to, and a name change months later should not
  -- rewrite history.
  name         text,
  -- Approximate, city-level, best-effort (src/lib/geolocate.ts). Often null.
  location     text,
  device       text,
  referrer     text,
  entry_path   text,
  last_path    text,
  page_count   integer not null default 0,
  started_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists public.site_visit_pages (
  id         bigint generated always as identity primary key,
  visit_id   uuid not null references public.site_visits(id) on delete cascade,
  path       text not null,
  -- The friendly label describePage() produced ("Viewing a product"), stored
  -- next to the raw path so the admin table reads as English, and so old rows
  -- keep their meaning after the route labels are reworded.
  label      text,
  section    text,
  entered_at timestamptz not null default now(),
  -- Bumped by every heartbeat while the visitor is still on this page, and
  -- frozen the moment they navigate away.
  left_at    timestamptz not null default now(),
  seconds    integer not null default 0
);

create index if not exists site_visits_started_idx    on public.site_visits (started_at desc);
create index if not exists site_visits_visitor_idx    on public.site_visits (visitor_id);
create index if not exists site_visits_user_idx       on public.site_visits (user_id) where user_id is not null;
create index if not exists site_visit_pages_visit_idx on public.site_visit_pages (visit_id, entered_at);
create index if not exists site_visit_pages_path_idx  on public.site_visit_pages (path);

-- ── The single writer ───────────────────────────────────────────────────────
-- Called on first paint, on every route change, on every heartbeat, and once
-- more when the tab is hidden or closed. One function covers all four because
-- they are the same statement — "this tab is on this page, now" — and letting
-- the server work out whether that means a new visit, a new page, or another
-- few seconds on the current one keeps the client from tracking state it is
-- going to lose when the tab dies mid-session.

create or replace function public.track_visit(
  p_visit_id   uuid,
  p_visitor_id text,
  p_role       text,
  p_name       text,
  p_location   text,
  p_path       text,
  p_label      text,
  p_section    text,
  p_device     text default null,
  p_referrer   text default null
) returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_open_id   bigint;
  v_open_path text;
  v_pages     integer;
  v_visitor   text := btrim(coalesce(p_visitor_id, ''));
  v_path      text := left(btrim(coalesce(p_path, '')), 400);
begin
  -- Malformed call: record nothing, raise nothing. Analytics must never be
  -- able to surface an error onto a shopper's page.
  if p_visit_id is null or v_visitor = '' or v_path = '' then
    return;
  end if;

  insert into public.site_visits as v (
    id, visitor_id, user_id, role, name, location, device, referrer,
    entry_path, last_path, page_count, started_at, last_seen_at
  ) values (
    p_visit_id,
    v_visitor,
    auth.uid(),
    coalesce(nullif(btrim(coalesce(p_role, '')), ''), 'guest'),
    nullif(btrim(coalesce(p_name, '')), ''),
    nullif(btrim(coalesce(p_location, '')), ''),
    nullif(btrim(coalesce(p_device, '')), ''),
    nullif(btrim(coalesce(p_referrer, '')), ''),
    v_path, v_path,
    0, now(), now()
  )
  -- The `where` below is the anti-hijack clause. Visit ids are unguessable v4
  -- uuids, but "unguessable" is not "unforgeable": without it, a client that
  -- did learn another tab's id could rewrite that session's name, role and
  -- location. Knowing the visitor_id too is the second factor, and a mismatch
  -- simply updates nothing rather than raising — the caller is a shopper's
  -- browser, and an exception there is a broken page.
  on conflict (id) do update set
    -- A guest who signs in mid-visit becomes attributable from that point on;
    -- signing out never un-attributes the visit that already happened.
    user_id      = coalesce(auth.uid(), v.user_id),
    role         = coalesce(nullif(btrim(coalesce(p_role, '')), ''), v.role),
    -- coalesce, not overwrite: geolocation resolves several seconds AFTER the
    -- first beat, so the beats that follow must not blank it again.
    name         = coalesce(nullif(btrim(coalesce(p_name, '')), ''), v.name),
    location     = coalesce(nullif(btrim(coalesce(p_location, '')), ''), v.location),
    device       = coalesce(nullif(btrim(coalesce(p_device, '')), ''), v.device),
    last_path    = v_path,
    last_seen_at = now()
  where v.visitor_id = v_visitor;

  -- Either the insert was skipped and the update refused (a hijack attempt),
  -- or the row is genuinely ours. Only the second case may write page rows.
  select page_count into v_pages
    from public.site_visits
   where id = p_visit_id and visitor_id = v_visitor;

  if v_pages is null then
    return;
  end if;

  -- A single tab cannot legitimately visit a thousand pages; a script pointed
  -- at this function can. The cap bounds the damage without putting a rate
  -- limiter in front of an endpoint whose entire job is to be called often.
  if v_pages >= 1000 then
    return;
  end if;

  select id, path into v_open_id, v_open_path
    from public.site_visit_pages
   where visit_id = p_visit_id
   order by entered_at desc, id desc
   limit 1;

  if v_open_id is null or v_open_path is distinct from v_path then
    -- A new page. Nothing needs closing: the previous row's left_at is already
    -- the last beat before they navigated, which IS when they left it.
    insert into public.site_visit_pages (visit_id, path, label, section, entered_at, left_at, seconds)
    values (
      p_visit_id, v_path,
      nullif(btrim(coalesce(p_label, '')), ''),
      nullif(btrim(coalesce(p_section, '')), ''),
      now(), now(), 0
    );

    update public.site_visits set page_count = page_count + 1 where id = p_visit_id;
  else
    -- Same page, still here: extend the dwell time.
    update public.site_visit_pages
       set left_at = now(),
           seconds = greatest(0, floor(extract(epoch from (now() - entered_at))))::integer
     where id = v_open_id;
  end if;
end;
$fn$;

-- ── Aggregate for the console header ────────────────────────────────────────
-- The Visitors page shows totals over a window that will eventually cover more
-- rows than are worth shipping to a browser. Counting here keeps the tiles
-- honest at any volume while the table beneath them stays paginated.
--
-- SECURITY DEFINER with an explicit is_admin() gate, rather than INVOKER
-- leaning on the select policy: an aggregate that silently returns zeros to a
-- non-admin reads as "no traffic", which is a worse answer than a refusal.

create or replace function public.visit_stats(p_since timestamptz)
returns table (
  visits      bigint,
  visitors    bigint,
  signed_in   bigint,
  guests      bigint,
  page_views  bigint,
  avg_seconds integer,
  avg_pages   numeric
)
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if not is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  return query
  select
    count(*)::bigint,
    count(distinct s.visitor_id)::bigint,
    count(*) filter (where s.user_id is not null)::bigint,
    count(*) filter (where s.user_id is null)::bigint,
    coalesce(sum(s.page_count), 0)::bigint,
    coalesce(avg(extract(epoch from (s.last_seen_at - s.started_at))), 0)::integer,
    round(coalesce(avg(s.page_count), 0), 1)
  from public.site_visits s
  where s.started_at >= p_since;
end;
$fn$;

-- ── Retention ───────────────────────────────────────────────────────────────
-- Every page view of every visitor is the fastest-growing table this app will
-- ever have, and none of it is worth keeping for a year. Run this by hand, or
-- schedule it deliberately; it is NOT wired to pg_cron here, because the one
-- cron job this project does have needed re-applying by hand before it worked
-- at all (0094), and a scheduler that silently does nothing is worse than an
-- obvious manual step.
--
--   select purge_old_visits(90);   -- drop visits older than 90 days
--
-- site_visit_pages goes with them via the cascade.

create or replace function public.purge_old_visits(p_days integer default 90)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  n integer;
begin
  if not is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  delete from public.site_visits
   where started_at < now() - make_interval(days => greatest(1, p_days));
  get diagnostics n = row_count;
  return n;
end;
$fn$;

-- ── RLS and grants ──────────────────────────────────────────────────────────

alter table public.site_visits      enable row level security;
alter table public.site_visit_pages enable row level security;

-- Read: admins only. There is deliberately no insert/update/delete policy on
-- either table — track_visit() is SECURITY DEFINER and bypasses RLS, so the
-- ABSENCE of a write policy is what stops anyone writing by any other route.
drop policy if exists site_visits_admin_read on public.site_visits;
create policy site_visits_admin_read on public.site_visits
  for select to authenticated using (is_admin());

drop policy if exists site_visit_pages_admin_read on public.site_visit_pages;
create policy site_visit_pages_admin_read on public.site_visit_pages
  for select to authenticated using (is_admin());

revoke all on public.site_visits      from anon, authenticated;
revoke all on public.site_visit_pages from anon, authenticated;
grant select on public.site_visits      to authenticated;
grant select on public.site_visit_pages to authenticated;

-- The writer is the one thing an anonymous shopper may call.
revoke all on function public.track_visit(uuid, text, text, text, text, text, text, text, text, text) from public;
grant execute on function public.track_visit(uuid, text, text, text, text, text, text, text, text, text) to anon, authenticated;

revoke all on function public.visit_stats(timestamptz) from public;
grant execute on function public.visit_stats(timestamptz) to authenticated;

revoke all on function public.purge_old_visits(integer) from public;
grant execute on function public.purge_old_visits(integer) to authenticated;

comment on table public.site_visits is
  'One row per browser tab session. Written only by track_visit(); readable only by admins. Live "who is online now" is Realtime presence, not this table.';
comment on table public.site_visit_pages is
  'One row per page within a visit, with dwell seconds. Cascades with its visit.';
