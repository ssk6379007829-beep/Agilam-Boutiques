-- Schema hardening: align the subscriptions plan with the current monetization
-- model (M-02) and enforce case-insensitive email uniqueness on profiles (M-03).
--
-- Additive and idempotent. Run once in the Supabase SQL editor after 0001–0011.

-- ── M-02: drop the removed 'featured' plan tier ─────────────────────────────
-- Monetization is commission + ads only; the "Featured" tier was removed
-- app-side. Migrate any stragglers to 'boutique', then tighten the constraint.
do $$ begin
  update subscriptions set plan = 'boutique' where plan = 'featured';
  alter table subscriptions drop constraint if exists subscriptions_plan_check;
  alter table subscriptions add constraint subscriptions_plan_check check (plan in ('boutique'));
exception
  when undefined_table then null;   -- subscriptions table not present in this env
end $$;

-- ── M-03: case-insensitive unique email on profiles ─────────────────────────
-- api/admin-create-user.js checks for an existing email before inserting, but a
-- race could still create duplicates. This closes the gap at the database.
-- Partial (email is not null) so multiple guest/anon rows with null email are
-- still allowed; lower() makes it case-insensitive.
create unique index if not exists profiles_email_lower_uniq
  on profiles (lower(email)) where email is not null;
