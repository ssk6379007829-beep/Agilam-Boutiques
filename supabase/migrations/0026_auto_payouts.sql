-- Automatic seller payouts on delivery (RazorpayX).
--
-- Builds on 0025's manual payout console. Once a PREPAID order has been
-- delivered and has sat out a hold window (so returns/disputes can surface
-- before the money is gone), a daily job (api/run-payouts.js) pushes the
-- seller's net — goods − 10% — to their registered bank/UPI via RazorpayX, and
-- records it in the same `payouts` table so nothing is ever paid twice.
--
-- COD is deliberately NOT auto-paid: on COD the seller already holds the cash
-- and OWES the platform, so there is nothing to send. That stays a manual
-- net-off on the admin console.
--
-- Idempotent. Requires 0022 (payment_status/method) + 0025 (payouts).

-- ── When was an order delivered? ────────────────────────────────────────────
-- The hold window is measured from delivery, so we need the moment it happened.
-- Existing delivered orders are intentionally left NULL: without a real delivery
-- time they must not be swept into an automatic payout — the admin settles those
-- by hand. Only deliveries from here on are eligible for auto-payout.
alter table orders add column if not exists delivered_at timestamptz;
create index if not exists idx_orders_delivered_at on orders (delivered_at);

-- Stamp delivered_at on the pending→delivered transition, and stop a seller
-- back-dating it to jump the hold window (they can mark delivered, but they
-- cannot choose *when* the clock started).
create or replace function orders_stamp_delivered()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'delivered' and old.status is distinct from 'delivered' then
    new.delivered_at := now();
  elsif not is_admin() and new.delivered_at is distinct from old.delivered_at then
    new.delivered_at := old.delivered_at;
  end if;
  return new;
end $$;

drop trigger if exists orders_stamp_delivered on orders;
create trigger orders_stamp_delivered
  before update on orders
  for each row execute function orders_stamp_delivered();

-- ── Payout lifecycle + provider fields ──────────────────────────────────────
-- A manual settlement is 'paid' the instant it is recorded; an automatic one is
-- 'processing' while RazorpayX moves the money and only becomes 'paid' when the
-- payout webhook confirms it (or 'failed'/'reversed', which releases the orders
-- to be retried on the next run).
alter table payouts add column if not exists status text not null default 'paid';
do $$ begin
  alter table payouts add constraint payouts_status_check
    check (status in ('processing', 'paid', 'failed', 'reversed'));
exception when duplicate_object then null; end $$;

alter table payouts add column if not exists provider text not null default 'manual';
do $$ begin
  alter table payouts add constraint payouts_provider_check
    check (provider in ('manual', 'razorpayx'));
exception when duplicate_object then null; end $$;

alter table payouts add column if not exists method text;               -- 'bank' | 'upi'
alter table payouts add column if not exists provider_payout_id text;   -- RazorpayX payout id (pout_...)
alter table payouts add column if not exists utr text;                  -- bank reference once settled
alter table payouts add column if not exists failure_reason text;

create index if not exists idx_payouts_status on payouts (status);
create unique index if not exists uq_payouts_provider_payout_id
  on payouts (provider_payout_id) where provider_payout_id is not null;

-- ── Seller RazorpayX identifiers ────────────────────────────────────────────
-- Created once per boutique (a RazorpayX "contact" + "fund account") and reused,
-- so we never re-register a bank account on every payout. Not in 0021's public
-- column grants, so — like the bank details themselves — they are readable only
-- by the service role and never leak to a browser.
alter table boutiques add column if not exists razorpayx_contact_id text;
alter table boutiques add column if not exists razorpayx_fund_account_id text;
alter table boutiques add column if not exists payout_details_verified boolean not null default false;

-- ── Open an automatic payout for one boutique ───────────────────────────────
-- Collects the boutique's prepaid, delivered-and-held, not-yet-settled orders,
-- writes a 'processing' payout for  goods − 10%, and stamps those orders so a
-- second run can never pick them up again. The transfer itself is fired by the
-- endpoint after this returns; on failure it calls fail_auto_payout to release
-- the orders. Recomputed server-side — the client never supplies an amount.
create or replace function open_auto_payout(
  p_boutique_id uuid,
  p_cutoff timestamptz,
  p_method text default null
)
returns payouts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rate constant numeric := 0.10;
  v_payout payouts;
  v_ids uuid[];
  v_count int := 0;
  v_goods numeric := 0;
  v_commission numeric := 0;
  v_fees numeric := 0;
  v_amount numeric := 0;
begin
  select
    coalesce(array_agg(o.id), '{}'::uuid[]),
    count(*)::int,
    coalesce(sum(o.total), 0),
    coalesce(sum(round(o.total * v_rate, 2)), 0),
    coalesce(sum(o.cod_fee + o.shipping_fee), 0)
  into v_ids, v_count, v_goods, v_commission, v_fees
  from orders o
  where o.boutique_id = p_boutique_id
    and o.payout_id is null
    and o.payment_method is distinct from 'COD'   -- prepaid only
    and o.payment_status = 'paid'
    and o.refunded = false
    and o.status = 'delivered'
    and o.delivered_at is not null
    and o.delivered_at <= p_cutoff
    and coalesce(o.channel, 'online') <> 'offline';

  if v_count = 0 then
    return null;
  end if;

  v_amount := v_goods - v_commission;

  insert into payouts (
    boutique_id, amount, orders_count, gross, commission, fees, cod_adjustment,
    status, provider, method
  ) values (
    p_boutique_id, round(v_amount, 2), v_count, round(v_goods, 2),
    round(v_commission, 2), round(v_fees, 2), 0,
    'processing', 'razorpayx', p_method
  )
  returning * into v_payout;

  update orders set payout_id = v_payout.id where id = any(v_ids);
  return v_payout;
end $$;

-- ── Confirm / fail an automatic payout ──────────────────────────────────────
create or replace function mark_auto_payout_paid(
  p_payout_id uuid,
  p_provider_payout_id text default null,
  p_utr text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update payouts
     set status = 'paid',
         provider_payout_id = coalesce(p_provider_payout_id, provider_payout_id),
         utr = coalesce(p_utr, utr)
   where id = p_payout_id;
end $$;

-- Set the provider id while the transfer is still in flight, so a webhook that
-- arrives before we've stored it can still be matched.
create or replace function set_auto_payout_reference(
  p_payout_id uuid,
  p_provider_payout_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update payouts set provider_payout_id = p_provider_payout_id where id = p_payout_id;
end $$;

-- Release the orders back to the pool (payout_id = null) so the next run retries
-- them, and keep the failed row for the audit trail.
create or replace function fail_auto_payout(
  p_payout_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update orders set payout_id = null where payout_id = p_payout_id;
  update payouts
     set status = 'failed',
         failure_reason = left(coalesce(p_reason, 'unknown'), 500)
   where id = p_payout_id
     and status <> 'paid';   -- never unwind one that already settled
end $$;

-- These are called only by the payout job with the service role; keep them off
-- the public API surface but grant the one role that actually runs them.
revoke all on function open_auto_payout(uuid, timestamptz, text) from public, anon, authenticated;
revoke all on function mark_auto_payout_paid(uuid, text, text) from public, anon, authenticated;
revoke all on function set_auto_payout_reference(uuid, text) from public, anon, authenticated;
revoke all on function fail_auto_payout(uuid, text) from public, anon, authenticated;

grant execute on function open_auto_payout(uuid, timestamptz, text) to service_role;
grant execute on function mark_auto_payout_paid(uuid, text, text) to service_role;
grant execute on function set_auto_payout_reference(uuid, text) to service_role;
grant execute on function fail_auto_payout(uuid, text) to service_role;
