-- Guarantee every auth user has a profiles row.
--
-- PROBLEM: profile rows were only ever created client-side, by
-- AuthContext.ensureProfile(), and only once a real session exists. That misses
-- users whenever the client path doesn't complete a clean write:
--   • email + password signup with "Confirm email" ON returns NO session, so the
--     profile is never inserted until (if ever) the user confirms and signs in;
--   • an email-OTP / password sign-in whose insert races RLS or fails silently;
--   • any user created straight in the Supabase dashboard or via the Admin API.
-- Google users always have a verified email → an immediate session → a profile,
-- which is why the admin Users list showed *only* Google accounts.
--
-- FIX: the canonical Supabase pattern — a SECURITY DEFINER trigger on
-- auth.users that writes the profiles row for EVERY new user, regardless of
-- sign-in method, plus a one-time backfill for everyone who signed up before the
-- trigger existed. The client ensureProfile() stays (harmless: it upserts with
-- ignoreDuplicates and still hydrates the UI immediately) but is no longer the
-- source of truth.
--
-- Additive and idempotent; safe to run after 0001–0025.

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
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- One-time backfill: create the missing profile for any existing auth user that
-- never got one (e.g. the email/password accounts that are currently invisible
-- in the admin console).
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
where p.id is null;
