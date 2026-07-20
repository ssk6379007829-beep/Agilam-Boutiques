-- Lock down profile role/status escalation.
--
-- SECURITY FIX (critical): the "profiles: self update" RLS policy allows a user
-- to update their own row (id = auth.uid()) with no restriction on *which*
-- columns change. Because the app talks to Supabase with the anon key and a
-- normal user session, ANY signed-in buyer could run
--     supabase.from('profiles').update({ role: 'admin' }).eq('id', <self>)
-- straight from the browser console and gain the admin console + every
-- admin-only RLS grant (all orders, all profiles/PII, refunds, ads…). A blocked
-- user could likewise flip their own status back to 'active'.
--
-- RLS WITH CHECK can't compare OLD vs NEW, so we enforce the invariant with a
-- BEFORE UPDATE trigger instead. This is purely additive and idempotent.
--
-- What stays allowed:
--   • buyer → seller self-claim (Google OAuth onboarding, AuthContext.claimRole)
--   • a real admin changing anyone's role/status (admin console) — is_admin() true
--   • normal profile edits (full_name/phone/city) — role/status untouched
-- What is now blocked:
--   • a non-admin granting themselves (or anyone) the 'admin' role
--   • a non-admin changing status / deleted_at (self un-block / un-delete)
--
-- Run once in the Supabase SQL editor after 0001–0009.

create or replace function guard_profile_privileges()
returns trigger
language plpgsql
as $$
begin
  -- Only an existing admin may grant the admin role.
  if new.role is distinct from old.role
     and new.role = 'admin'
     and not is_admin() then
    raise exception 'not authorized to grant the admin role';
  end if;

  -- Only an admin may change account status / soft-delete flags. For everyone
  -- else, silently pin these back to their stored values so an ordinary profile
  -- edit (name/phone/city) still succeeds without touching moderation state.
  if not is_admin() then
    if new.status is distinct from old.status then
      new.status := old.status;
    end if;
    if new.deleted_at is distinct from old.deleted_at then
      new.deleted_at := old.deleted_at;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_profile_privileges on profiles;
create trigger trg_guard_profile_privileges
  before update on profiles
  for each row
  execute function guard_profile_privileges();
