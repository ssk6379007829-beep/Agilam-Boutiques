-- Guarantee EVERY Supabase Auth user shows in the admin Users list.
--
-- PROBLEM: the admin console reads the `profiles` table. Any auth user without
-- a profiles row is invisible there — "some users in the DB but not in the UI".
-- Migration 0028 added a trigger + one-time backfill for this, but users can
-- still slip through if:
--   • 0028 was never applied on this project;
--   • the trigger errored for a row (e.g. a transient issue) and, because it ran
--     inline with signup, either blocked it or was bypassed;
--   • accounts were created directly in the Supabase dashboard before 0028.
--
-- FIX: a hardened, self-contained version of the trigger + a full re-backfill.
-- This supersedes 0028 and is safe to run whether or not 0028 was applied.
--   1. handle_new_user now NEVER blocks signup: if the profile insert fails it
--      swallows the error and logs a warning, so auth always succeeds and the
--      row can be reconciled by the backfill below.
--   2. The backfill also repairs existing profiles whose email drifted to NULL
--      (older rows created before we stored the email), so the admin search and
--      list always have an address to show.
--
-- Additive and idempotent; safe to run any number of times, after 0001–0029.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public as $$
declare
  meta_role text := new.raw_user_meta_data->>'role';
begin
  insert into public.profiles (id, role, full_name, email, city)
  values (
    new.id,
    -- Only buyer/seller may be seeded from signup metadata; admin is never
    -- self-assignable (mirrors the guard trigger in migration 0010).
    case when meta_role in ('buyer','seller') then meta_role else 'buyer' end,
    coalesce(
      nullif(new.raw_user_meta_data->>'full_name', ''),
      case when coalesce(new.is_anonymous, false) then 'Customer' else 'New user' end
    ),
    new.email,
    nullif(new.raw_user_meta_data->>'city', '')
  )
  on conflict (id) do nothing;
  return new;
exception when others then
  -- Never let a profile write break account creation. The backfill below (and
  -- the next run of this migration) reconciles anything that lands here.
  raise warning 'handle_new_user: could not create profile for %: %', new.id, sqlerrm;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Full backfill: create the missing profile for every auth user that lacks one.
insert into public.profiles (id, role, full_name, email, city)
select
  u.id,
  case when u.raw_user_meta_data->>'role' in ('buyer','seller') then u.raw_user_meta_data->>'role' else 'buyer' end,
  coalesce(
    nullif(u.raw_user_meta_data->>'full_name', ''),
    case when coalesce(u.is_anonymous, false) then 'Customer' else 'New user' end
  ),
  u.email,
  nullif(u.raw_user_meta_data->>'city', '')
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;

-- Repair existing profiles whose email is missing but the auth record has one,
-- so every user is searchable and shows an address in the admin list.
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id
  and (p.email is null or p.email = '')
  and u.email is not null and u.email <> '';
