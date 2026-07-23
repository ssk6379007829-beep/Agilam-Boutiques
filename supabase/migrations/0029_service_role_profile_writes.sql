-- Allow the server (service-role key) to set profile role/status.
--
-- BUG: creating an *admin* from the admin console (/api/admin-create-user) always
-- failed. The chain was:
--   1. auth.admin.createUser() inserts into auth.users → migration 0028's
--      on_auth_user_created trigger inserts a profiles row FORCED to role='buyer'
--      (admin is never seeded from signup metadata, by design).
--   2. The API then upserts { role:'admin', ... }. Because the row already exists,
--      the upsert runs as an UPDATE.
--   3. Migration 0010's BEFORE UPDATE guard guard_profile_privileges() fires. It
--      calls is_admin() = (auth.uid() has role 'admin'). But the API talks to
--      Supabase with the SERVICE-ROLE key, so auth.uid() is NULL → is_admin() is
--      false → the guard raises 'not authorized to grant the admin role'.
--   4. The API sees the error, deletes the auth user, and reports failure.
-- Buyer/seller creation slipped through only because their role isn't 'admin'.
--
-- FIX: recognise the trusted server context. The service-role key is NEVER
-- exposed to the browser, so a write made with it is already privileged — the
-- guard (which exists to stop a signed-in *buyer* escalating themselves from the
-- browser) must not apply to it. We short-circuit the guard when the caller is
-- the service role, detected from the Postgres role PostgREST switches to and,
-- as a fallback, the JWT 'role' claim.
--
-- Additive and idempotent; safe to run after 0001–0028.

create or replace function public.is_service_role()
returns boolean
language plpgsql
stable
as $$
declare
  claims text;
  claim_role text := '';
begin
  -- PostgREST switches the Postgres role to service_role for a service-key call.
  if current_user = 'service_role' or session_user = 'service_role' then
    return true;
  end if;

  -- Fallback: inspect the JWT 'role' claim (newer json GUC, then legacy dotted).
  claims := current_setting('request.jwt.claims', true);
  if claims is not null and claims <> '' then
    begin
      claim_role := coalesce(claims::jsonb ->> 'role', '');
    exception when others then
      claim_role := '';
    end;
  end if;
  if claim_role = '' then
    claim_role := coalesce(current_setting('request.jwt.claim.role', true), '');
  end if;

  return claim_role = 'service_role';
end;
$$;

create or replace function guard_profile_privileges()
returns trigger
language plpgsql
as $$
begin
  -- Trusted server context: writes made with the service-role key (server-only,
  -- never in the browser) are pre-authorised. Without this, a server-side
  -- role/status write runs with auth.uid() = NULL → is_admin() = false and is
  -- rejected — which broke /api/admin-create-user for admin accounts.
  if public.is_service_role() then
    return new;
  end if;

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
