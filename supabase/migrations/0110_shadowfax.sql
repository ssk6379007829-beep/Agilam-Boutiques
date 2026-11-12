-- Shadowfax as a second booking provider, and the money it costs us.
--
-- Everything here is ADDITIVE. It does not touch settle_boutique_payout() —
-- that one needs its live definition read first (CLAUDE.md), so it is deferred
-- to its own migration and this file can be applied without that risk.
--
-- WHAT THIS IS FOR
-- `shipments` has carried a `provider` column since 0067, constrained to
-- ('manual','shiprocket'). Shadowfax is a third value. The scan pipeline —
-- apply_shipment_scan(), shipment_events, the payout delivery gate — is already
-- provider-agnostic and is deliberately NOT modified: a Shadowfax scan arrives
-- through the same narrow write path a Shiprocket one does.
--
-- WHY A SERVICE LEVEL
-- Shadowfax sells two different things and we buy both: an intracity hyperlocal
-- run measured in hours, and a surface parcel measured in days. The buyer's
-- timeline and the delivery promise read completely differently for each, so a
-- shipment has to remember which it is. resolveZone/zoneFor pick it from the
-- buyer's pincode: the shop's own town is hyperlocal, every wider band surface.

-- ── Provider ────────────────────────────────────────────────────────────────
-- Dropped and re-added rather than altered: a CHECK constraint cannot be
-- widened in place, and a bare `add constraint` would raise duplicate_object on
-- any database that already has 0067's version.
alter table shipments drop constraint if exists shipments_provider_check;
alter table shipments add constraint shipments_provider_check
  check (provider in ('manual', 'shiprocket', 'shadowfax'));

alter table shipments add column if not exists service_level text;

do $$ begin
  alter table shipments add constraint shipments_service_level_check
    check (service_level is null or service_level in ('hyperlocal', 'surface'));
exception when duplicate_object then null; end $$;

comment on column shipments.service_level is
  'Shadowfax only. hyperlocal = intracity, delivered in hours, booked when the buyer is in the shop''s own town. surface = the district/state/national bands. NULL on a manual or Shiprocket parcel, which have no such split.';

-- ── Their identifiers ───────────────────────────────────────────────────────
-- Mirrors the sr_* set from 0067. Provider-prefixed rather than shared: two
-- providers' ids have no reason to live in one column, and a support query that
-- must ask "which provider was this?" before reading an id is how the wrong
-- parcel gets cancelled.
alter table shipments add column if not exists sfx_order_id    text;
alter table shipments add column if not exists sfx_shipment_id text;
-- Hyperlocal assigns a named rider; surface does not. Worth storing: it is the
-- most useful thing a seller can be told when a pickup is late, and the first
-- thing support asks for.
alter table shipments add column if not exists sfx_rider_name  text;
alter table shipments add column if not exists sfx_rider_phone text;

create index if not exists idx_shipments_sfx_shipment on shipments (sfx_shipment_id)
  where sfx_shipment_id is not null;

-- ── RTO: record the cost, decide it by hand ─────────────────────────────────
-- 0067 left this open on purpose ("who eats the RTO freight is an admin's to
-- settle"). It stays a human decision, because fault genuinely varies: a wrong
-- pincode is the buyer's, a parcel refused at the door is nobody's, and a shop
-- that packed the wrong size caused its own return. What changes is that the
-- number stops being invisible.
alter table shipments add column if not exists rto_freight_charge numeric(10,2);
alter table shipments add column if not exists rto_bearer         text;
alter table shipments add column if not exists rto_decided_at     timestamptz;
alter table shipments add column if not exists rto_decided_by     uuid references auth.users(id);

do $$ begin
  alter table shipments add constraint shipments_rto_bearer_check
    check (rto_bearer is null or rto_bearer in ('seller', 'platform'));
exception when duplicate_object then null; end $$;

comment on column shipments.rto_bearer is
  'Who absorbs the return freight, set by an admin in the console. NULL = undecided, which is the state every RTO starts in. Recording it moves no money on its own; the order is already frozen out of the payout sweep by 0063''s delivery_disputed flag, which apply_shipment_scan() sets on an RTO scan.';

-- ── What the parcel cost us, against what the buyer paid ────────────────────
-- NOT a seller deduction. The buyer's delivery charge (orders.shipping_fee) is
-- collected by the PLATFORM, not the seller: the payout is goods minus
-- commission and has never included it — 0025 through 0078a compute
-- v_prepaid_fees from shipping_fee, record it on the payout row, and
-- deliberately leave it out of v_amount. src/data/payouts.ts agrees
-- (net = goods - commission). So a booked parcel is already funded, and 0067's
-- freight_charge is the cost side of that same transaction. This view puts the
-- two side by side so an under-priced distance band becomes visible instead of
-- quietly eating the margin.
-- CLAUDE.md rule 7: RLS is the security boundary. A view runs as its OWNER by
-- default, which would hand every row of orders/shipments to anyone who can
-- reach it through PostgREST — RLS on the base tables is never consulted.
-- security_invoker makes the view obey the CALLER's policies, and the revoke
-- keeps anon off it regardless.
create or replace view shipment_freight_margin
  with (security_invoker = on) as
select
  s.id             as shipment_id,
  s.order_id,
  s.boutique_id,
  s.provider,
  s.service_level,
  o.shipping_fee   as buyer_paid,
  s.freight_charge as we_paid,
  round(coalesce(o.shipping_fee, 0) - coalesce(s.freight_charge, 0), 2) as margin,
  s.rto_freight_charge,
  s.shipped_at
from shipments s
join orders o on o.id = s.order_id
where s.provider <> 'manual';

comment on view shipment_freight_margin is
  'Per-parcel delivery margin: what the buyer was charged for delivery minus what the courier charged us. Negative means that shop''s distance band for that zone is priced below our cost. Admin reporting only.';

revoke all on shipment_freight_margin from anon;
grant select on shipment_freight_margin to authenticated;

-- ── Switches ────────────────────────────────────────────────────────────────
-- Same two-key shape as Shiprocket (0067): a platform master switch and a
-- per-shop one, and booking needs BOTH. A single global flag cannot express
-- "live, but only for the shops whose pickup address we have verified", which
-- is the only sane way to roll a courier integration out.
alter table platform_settings add column if not exists shadowfax_enabled boolean not null default false;
alter table boutiques         add column if not exists shadowfax_enabled boolean not null default false;

comment on column platform_settings.shadowfax_enabled is
  'Master switch for Shadowfax booking. Off = the booking function refuses for every shop, whatever that shop''s own flag says.';

-- CLAUDE.md rule 5: `boutiques` lost its blanket SELECT in 0021. A column not
-- named in a grant is invisible even to its owner, so the seller console would
-- read NULL and silently show booking as unavailable.
grant select (shadowfax_enabled) on boutiques to anon, authenticated;

-- ── No platform-booked cash orders, for ANY provider ────────────────────────
-- Supersedes 0067's version, which named 'shiprocket' literally and would
-- therefore have let a historical COD order through on Shadowfax. Cash on
-- delivery was withdrawn in 0085, but pre-0085 cash orders are real rows that
-- still have to add up (CLAUDE.md rule 9), and a courier remitting their cash
-- to the platform wallet would make us the money handler.
--
-- Rewritten as "anything we book ourselves" so the next provider is covered by
-- construction rather than by remembering to edit this. 0067 is the only
-- migration that has ever defined this function, so nothing later is reverted.
create or replace function shipments_reject_cod_booking()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_method text;
begin
  if new.provider <> 'manual' then
    select payment_method into v_method from orders where id = new.order_id;
    if v_method = 'COD' then
      raise exception 'Cash-on-delivery orders cannot be booked through a platform courier account — ship this one with your own courier and enter the docket number'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_shipments_reject_cod on shipments;
create trigger trg_shipments_reject_cod
  before insert or update of provider on shipments
  for each row execute function shipments_reject_cod_booking();
