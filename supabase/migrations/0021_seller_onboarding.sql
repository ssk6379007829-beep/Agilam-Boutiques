-- Seller onboarding — the 7-step setup wizard, admin verification, and the
-- column-level lockdown that keeps payout details off the public API.
--
-- Until now a seller's boutique was created from two fields (name + city). The
-- production flow collects boutique branding, contact, address, business,
-- store settings and payout details, then submits the boutique for admin
-- review. This migration adds every column that wizard writes.
--
-- ── Why the grants at the bottom matter ─────────────────────────────────────
-- `boutiques` is readable by anonymous buyers (policy "boutiques: public read
-- approved"), and the app fetched it with `select('*')`. Adding bank account
-- numbers and IFSC codes as plain columns would therefore have published them
-- to every visitor. RLS is row-level only — it cannot hide a column — so the
-- sensitive columns are withheld with column-level GRANTs instead, and the
-- owner/admin read them back through the `boutique_private` SECURITY DEFINER
-- function. Writes are unaffected: the UPDATE policy already restricts them to
-- the owner or an admin.
--
-- Because SELECT is granted per column, `select('*')` on boutiques now fails
-- for anon/authenticated. The app selects the explicit BOUTIQUE_COLUMNS list
-- (src/data/boutiques.ts) instead. A column added in a later migration is
-- invisible until it is granted here — failing closed is the intent.
--
-- Idempotent: re-runnable in the Supabase SQL editor.

-- ── Step 1 · Boutique information ───────────────────────────────────────────
-- name, description (bio), logo_url and cover_url already exist.
alter table boutiques add column if not exists owner_name text not null default '';

-- ── Step 2 · Contact information ────────────────────────────────────────────
-- phone and instagram already exist.
alter table boutiques add column if not exists whatsapp text;
alter table boutiques add column if not exists email text;

-- ── Step 3 · Shop address ───────────────────────────────────────────────────
-- city and area already exist.
alter table boutiques add column if not exists address_line text not null default '';
alter table boutiques add column if not exists district text not null default '';
alter table boutiques add column if not exists state text not null default '';
alter table boutiques add column if not exists pincode text not null default '';
alter table boutiques add column if not exists map_url text;

-- ── Step 4 · Business information ───────────────────────────────────────────
-- established_year already exists; years_in_business is what the wizard asks
-- for and is stored as given rather than derived, so a seller who only knows
-- one of the two still gets a sensible profile.
alter table boutiques add column if not exists category text not null default '';
alter table boutiques add column if not exists gst_number text;
alter table boutiques add column if not exists business_reg_number text;
alter table boutiques add column if not exists years_in_business int;

-- ── Step 5 · Store settings ─────────────────────────────────────────────────
-- Times are stored as 'HH:MM' text: they are display strings for the storefront,
-- never arithmetic, and a `time` column would drag timezone semantics in.
alter table boutiques add column if not exists open_time text not null default '';
alter table boutiques add column if not exists close_time text not null default '';
alter table boutiques add column if not exists working_days text[] not null default '{}';
alter table boutiques add column if not exists delivery_available boolean not null default true;
alter table boutiques add column if not exists delivery_areas text not null default '';
alter table boutiques add column if not exists delivery_charge numeric(10,2) not null default 0;
alter table boutiques add column if not exists cod_enabled boolean not null default true;
alter table boutiques add column if not exists online_payment_enabled boolean not null default true;

-- ── Step 6 · Payout details (sensitive — never granted to anon/authenticated)
alter table boutiques add column if not exists bank_account_name text;
alter table boutiques add column if not exists bank_account_number text;
alter table boutiques add column if not exists bank_ifsc text;
alter table boutiques add column if not exists upi_id text;

-- ── Step 7 · Review, submission and the admin decision ──────────────────────
-- onboarding_step is the furthest step the seller has completed, so a wizard
-- abandoned halfway resumes where they left off instead of restarting.
alter table boutiques add column if not exists onboarding_step int not null default 0;
alter table boutiques add column if not exists onboarding_complete boolean not null default false;
alter table boutiques add column if not exists submitted_at timestamptz;
alter table boutiques add column if not exists reviewed_at timestamptz;
alter table boutiques add column if not exists review_note text;

-- Seller notification preferences (the toggles on /seller/settings, which
-- previously lived in component state and were lost on every reload).
alter table boutiques add column if not exists notify_orders boolean not null default true;
alter table boutiques add column if not exists notify_messages boolean not null default true;
alter table boutiques add column if not exists notify_promotions boolean not null default false;

-- ── Admin decision: add the "needs changes" outcome ─────────────────────────
-- The review flow has three outcomes — approve, request changes, reject — but
-- the original CHECK only allowed pending/approved/rejected. A boutique in
-- 'changes_requested' shows the seller review_note as a correction list and
-- lets them edit and resubmit.
alter table boutiques drop constraint if exists boutiques_status_check;
alter table boutiques add constraint boutiques_status_check
  check (status in ('pending', 'draft', 'changes_requested', 'approved', 'rejected'));

-- Boutiques created before this migration were usable with two fields, so mark
-- them complete and submitted — they must not be dropped back into the wizard.
-- The cutoff is this migration's authoring date rather than now() so that
-- re-running the file never sweeps up a seller who is mid-wizard today.
update boutiques
   set onboarding_complete = true,
       onboarding_step = 7,
       submitted_at = coalesce(submitted_at, created_at)
 where onboarding_complete = false
   and created_at < timestamptz '2026-07-22 00:00:00+00';

-- ── Sellers cannot approve themselves ───────────────────────────────────────
-- The UPDATE policy on boutiques is `using (owner_id = auth.uid() or
-- is_admin())` with no WITH CHECK, so a seller could always PATCH their own row
-- with {"status":"approved","verified":true}. That was harmless while the
-- status only affected buyer-facing listing; now that it gates verification it
-- is a self-approval hole, so the admin-managed fields get a trigger guard.
--
-- Deliberately not guarded: rating, reviews_count and followers_count, which
-- 0014's review aggregate and 0004's follow toggle write through SECURITY
-- DEFINER functions where is_admin() is false for the calling buyer.
create or replace function boutiques_guard_admin_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resubmitting constant boolean :=
    new.status = 'pending' and old.status in ('draft', 'changes_requested', 'rejected');
begin
  if is_admin() then
    return new;
  end if;

  if new.verified is distinct from old.verified
  or new.featured is distinct from old.featured then
    raise exception 'boutiques: verified/featured are admin-managed';
  end if;

  -- The admin's decision fields are theirs to write, with one exception: when a
  -- seller resubmits after a correction list they may clear the stale note and
  -- review timestamp, so their status screen does not keep showing feedback
  -- they have already acted on. Setting them to anything else stays blocked.
  if new.review_note is distinct from old.review_note
  and not (resubmitting and new.review_note is null) then
    raise exception 'boutiques: review_note is admin-managed';
  end if;

  if new.reviewed_at is distinct from old.reviewed_at
  and not (resubmitting and new.reviewed_at is null) then
    raise exception 'boutiques: reviewed_at is admin-managed';
  end if;

  -- A seller may only move their own boutique between "still setting up" and
  -- "submitted for review". Approving or un-rejecting is the admin's call.
  if new.status is distinct from old.status and new.status not in ('draft', 'pending') then
    raise exception 'boutiques: status % is admin-managed', new.status;
  end if;

  return new;
end $$;

drop trigger if exists boutiques_guard_admin_fields on boutiques;
create trigger boutiques_guard_admin_fields
  before update on boutiques
  for each row execute function boutiques_guard_admin_fields();

-- ── Column-level lockdown ───────────────────────────────────────────────────
-- Withdraw the blanket SELECT, then hand back only the columns a buyer (or any
-- signed-in account that is not the owner) is allowed to see. gst_number,
-- business_reg_number, the four payout columns and the admin's review_note are
-- deliberately absent from both lists.
revoke select on boutiques from anon, authenticated;

do $$
declare
  cols constant text := '
    id, owner_id, name, slug, city, area, description, tone,
    cover_url, logo_url, phone, instagram, established_year,
    verified, status, featured, rating, reviews_count,
    followers_count, positive_rating, created_at,
    owner_name, whatsapp, email,
    address_line, district, state, pincode, map_url,
    category, years_in_business,
    open_time, close_time, working_days,
    delivery_available, delivery_areas, delivery_charge,
    cod_enabled, online_payment_enabled,
    onboarding_step, onboarding_complete, submitted_at, reviewed_at,
    notify_orders, notify_messages, notify_promotions
  ';
begin
  execute format('grant select (%s) on boutiques to anon', cols);
  execute format('grant select (%s) on boutiques to authenticated', cols);
end $$;

-- Owner and admin read the withheld columns through this function. SECURITY
-- DEFINER runs it as the table owner, so the column grants above do not apply
-- inside it; the WHERE clause is the access check.
--
-- Drop first: a later migration (0027) widens the OUT columns, and CREATE OR
-- REPLACE cannot change a function's return type (SQLSTATE 42P13). Dropping
-- makes this block re-runnable in any order.
drop function if exists boutique_private(uuid);
create function boutique_private(bid uuid)
returns table (
  gst_number text,
  business_reg_number text,
  bank_account_name text,
  bank_account_number text,
  bank_ifsc text,
  upi_id text,
  review_note text
)
language sql
security definer
stable
set search_path = public
as $$
  select b.gst_number, b.business_reg_number, b.bank_account_name,
         b.bank_account_number, b.bank_ifsc, b.upi_id, b.review_note
    from boutiques b
   where b.id = bid
     and (b.owner_id = auth.uid() or is_admin());
$$;

revoke all on function boutique_private(uuid) from public, anon;
grant execute on function boutique_private(uuid) to authenticated;
