-- DTDC as the primary booking provider.
--
-- Everything here is ADDITIVE and idempotent. It does not touch
-- apply_shipment_scan(), settle_boutique_payout() or any other function with a
-- live definition — the scan pipeline (0067) is already provider-agnostic, and a
-- third provider must not mean a third way to mark an order delivered.
--
-- Apply 0114, then set the DTDC secrets and deploy the Edge Functions, THEN
-- 0115 (the reconcile sweep, which needs a Vault secret and 0113's helper).
--
-- WHAT THIS IS FOR
-- DTDC is the platform's contracted carrier (customer code GL24686, account
-- opened 2026-11-14). `book-parcel` now tries it FIRST, then Shiprocket, then
-- Shadowfax, then the seller's manual docket form. `shipments.provider` gains
-- the value; the label lands in a private bucket because it carries the
-- buyer's address and phone; and the usual two switches gate the rollout.

-- ── Provider ────────────────────────────────────────────────────────────────
-- Dropped and re-added rather than altered: a CHECK constraint cannot be
-- widened in place. Same shape 0110 used to admit 'shadowfax'.
alter table shipments drop constraint if exists shipments_provider_check;
alter table shipments add constraint shipments_provider_check
  check (provider in ('manual', 'shiprocket', 'shadowfax', 'dtdc'));

-- Which carrier Shipsy actually allocated. "DTDC" for a normal consignment,
-- but their platform can route a lane to a partner, and the seller has to
-- recognise whoever turns up at the door.
alter table shipments add column if not exists dtdc_courier_partner text;

-- Bucket-relative path of the stored label PDF. Provider-neutral on purpose:
-- Shiprocket hands us a public `label_url`, DTDC hands us bytes, and the
-- console shows "Print label" for either. NULL = no label was captured.
alter table shipments add column if not exists label_path text;

comment on column shipments.label_path is
  'Path inside the private shipping-labels bucket, <boutique_id>/<awb>.pdf. The seller console signs a short-lived URL on demand. NULL when the label could not be fetched at booking — the seller downloads it from the courier portal instead.';

-- ── Switches ────────────────────────────────────────────────────────────────
-- Same two-key shape as Shiprocket (0067) and Shadowfax (0110): a platform
-- master switch and a per-shop one, and booking needs BOTH. A single global
-- flag cannot express "live, but only for the shops whose pickup address we
-- have checked", which is the only sane way to roll a carrier out.
alter table platform_settings add column if not exists dtdc_enabled boolean not null default false;
alter table boutiques         add column if not exists dtdc_enabled boolean not null default false;

comment on column platform_settings.dtdc_enabled is
  'Master switch for DTDC booking. Off = dtdc-book declines for every shop, whatever that shop''s own flag says, and the chain moves on to Shiprocket.';

-- CLAUDE.md rule 5: `boutiques` lost its blanket SELECT in 0021. A column not
-- named in a grant is invisible even to its owner, so the seller console would
-- read NULL and silently show booking as unavailable.
grant select (dtdc_enabled) on boutiques to anon, authenticated;

-- ── The buyer's tracking link ───────────────────────────────────────────────
-- 0063 seeded DTDC with no template because most Indian tracking pages are
-- form-POST. DTDC's does take the consignment number in the query string.
-- Only fills a NULL: an admin who has already set one keeps theirs.
update couriers
   set tracking_url_template = 'https://www.dtdc.in/tracking/tracking_results.asp?Ttype=awb_no&strCnno={awb}&TrkType2=awb_no'
 where name = 'DTDC' and tracking_url_template is null;

-- ── Labels: a private bucket ────────────────────────────────────────────────
-- A shipping label is the buyer's name, address and phone on one page. It is
-- never a public object. The booking function writes it as the service role
-- (which bypasses RLS); the seller reads their own boutique's folder; admins
-- read everything. Nobody else, and no anon access at all.
insert into storage.buckets (id, name, public)
values ('shipping-labels', 'shipping-labels', false)
on conflict (id) do update set public = false;

drop policy if exists "shipping-labels: owner read" on storage.objects;
create policy "shipping-labels: owner read" on storage.objects for select
  to authenticated
  using (
    bucket_id = 'shipping-labels'
    and exists (
      select 1 from boutiques b
      where b.id::text = (storage.foldername(name))[1]
        and b.owner_id = auth.uid()
    )
  );

-- is_admin() is safe for anon (never revoked), but `to authenticated` anyway:
-- nothing about a label is ever for a signed-out caller.
drop policy if exists "shipping-labels: admin read" on storage.objects;
create policy "shipping-labels: admin read" on storage.objects for select
  to authenticated
  using (bucket_id = 'shipping-labels' and is_admin());

-- No insert/update/delete policy on purpose. Writes come from the Edge Function
-- under the service role; a seller must not be able to replace a label.
