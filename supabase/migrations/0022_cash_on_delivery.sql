-- Cash on Delivery.
--
-- Until now every order was prepaid: api/place-order.js refused to write an
-- order without a gateway-signed Razorpay payment, precisely so the endpoint
-- could not be used to mint unpaid orders. COD deliberately opens that door, so
-- the money state an order used to carry implicitly ("it exists, therefore it
-- is paid") now has to be recorded explicitly.
--
-- `payment_status` is that record, and it is separate from `status` on purpose:
-- fulfilment and settlement move independently. A COD order is `delivered` +
-- `paid` only once the seller confirms the cash actually arrived; a prepaid
-- order is `paid` from the moment it is written.
--
-- Idempotent: re-runnable in the Supabase SQL editor.

-- ── Settlement state ────────────────────────────────────────────────────────
alter table orders add column if not exists payment_status text not null default 'paid';
do $$ begin
  alter table orders add constraint orders_payment_status_check
    check (payment_status in ('pending', 'paid', 'failed', 'refunded'));
exception when duplicate_object then null; end $$;

-- When the seller confirmed the cash was collected, and the COD handling fee
-- charged on this order (stored per-order so a later change to the fee never
-- rewrites the history of orders already placed).
alter table orders add column if not exists paid_at timestamptz;
alter table orders add column if not exists cod_fee numeric(10,2) not null default 0;

-- The delivery fee charged on this order.
--
-- `orders.total` has always been the goods value only: the cart-level shipping
-- was used to bind the Razorpay amount and then thrown away, so nothing in the
-- database knew what the buyer actually paid. That was survivable while every
-- order was prepaid — nobody had to count it out — but on COD it is the
-- difference between the seller collecting the right money and under-charging
-- by the delivery fee. Shipping is a single cart-level charge, so on a
-- multi-boutique cart it is recorded against the first order; summed across the
-- orders from one checkout it equals exactly what the buyer was quoted.
alter table orders add column if not exists shipping_fee numeric(10,2) not null default 0;

-- Every pre-COD order was prepaid by definition, so backfill rather than leave
-- them looking unsettled. Offline/walk-in bills were cash in hand at the till.
update orders
   set payment_status = 'paid',
       paid_at = coalesce(paid_at, created_at)
 where payment_status = 'paid'
   and paid_at is null;

-- ── Buyer-cancellable orders ────────────────────────────────────────────────
-- A COD buyer has no money at stake, so "I changed my mind" must be a button
-- rather than a support ticket. `cancelled` is distinct from `rejected`: the
-- buyer walked away, the seller did not turn them down, and the two need
-- different copy and different reporting.
alter table orders drop constraint if exists orders_status_check;
alter table orders add constraint orders_status_check
  check (status in ('pending', 'accepted', 'shipped', 'delivered', 'rejected', 'cancelled'));

alter table orders add column if not exists cancelled_at timestamptz;
alter table orders add column if not exists cancel_reason text;

create index if not exists idx_orders_payment_status on orders (payment_status);

-- ── Sellers may not mark themselves paid on a prepaid order ─────────────────
-- The UPDATE policy on orders is owner-or-admin with no WITH CHECK, so a seller
-- can write any column on their own orders. That is fine for fulfilment status,
-- but `payment_status` on a prepaid order is the gateway's business: letting a
-- seller flip a failed/refunded Razorpay order to 'paid' would fabricate
-- revenue in the payout report. They may only settle what they physically
-- collect — a COD order.
create or replace function orders_guard_payment_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if is_admin() then
    return new;
  end if;

  if new.payment_status is distinct from old.payment_status
     and coalesce(old.payment_method, '') <> 'COD' then
    raise exception 'orders: payment_status on a prepaid order is gateway-managed';
  end if;

  -- Money already collected cannot be un-collected by the seller; a genuine
  -- reversal is a refund, which is an admin action.
  if old.payment_status = 'paid' and new.payment_status = 'pending' then
    raise exception 'orders: a collected payment cannot be reopened';
  end if;

  -- The charged amounts are set once, server-side, from DB prices and the
  -- shared pricing rules. Nothing downstream (payout, commission, the buyer's
  -- receipt) survives them being edited later — and on a COD order, editing
  -- cod_fee or shipping_fee would change what the buyer is asked to hand over
  -- at the door, after they agreed to a different figure.
  if new.total is distinct from old.total
  or new.cod_fee is distinct from old.cod_fee
  or new.shipping_fee is distinct from old.shipping_fee then
    raise exception 'orders: charged amounts are immutable';
  end if;

  return new;
end $$;

drop trigger if exists orders_guard_payment_state on orders;
create trigger orders_guard_payment_state
  before update on orders
  for each row execute function orders_guard_payment_state();

-- ── Buyer cancellation ──────────────────────────────────────────────────────
-- Guests have no account, so RLS can never authorise them to update their own
-- order. Cancellation therefore runs as a SECURITY DEFINER function that
-- authorises on the order number plus the phone number captured at checkout —
-- the same pair the buyer already proves they know by having placed the order.
--
-- Only an un-dispatched, unpaid COD order can be cancelled this way: once the
-- seller has shipped, or once money has changed hands, cancelling is a
-- conversation rather than a button. Releasing the reserved stock is part of
-- the same call so a cancelled order cannot silently eat inventory.
create or replace function cancel_cod_order(
  p_order_number text,
  p_phone text,
  p_reason text default null
)
returns table (id uuid, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders%rowtype;
  v_items jsonb;
begin
  select * into v_order
    from orders o
   where o.order_number = p_order_number
     and (
       o.buyer_id = auth.uid()
       or (o.guest_phone is not null and o.guest_phone = p_phone)
     )
   limit 1;

  if v_order.id is null then
    raise exception 'ORDER_NOT_FOUND';
  end if;
  if v_order.payment_method is distinct from 'COD' then
    raise exception 'NOT_CANCELLABLE_PREPAID';
  end if;
  if v_order.status not in ('pending', 'accepted') then
    raise exception 'NOT_CANCELLABLE_DISPATCHED';
  end if;
  if v_order.payment_status = 'paid' then
    raise exception 'NOT_CANCELLABLE_PAID';
  end if;

  -- Put the reserved units back before the order stops being fulfillable.
  select jsonb_agg(jsonb_build_object('product_id', oi.product_id, 'qty', oi.qty))
    into v_items
    from order_items oi
   where oi.order_id = v_order.id
     and oi.product_id is not null;

  if v_items is not null then
    perform release_stock(v_items);
  end if;

  update orders
     set status = 'cancelled',
         cancelled_at = now(),
         cancel_reason = nullif(btrim(coalesce(p_reason, '')), '')
   where orders.id = v_order.id;

  return query select v_order.id, 'cancelled'::text;
end $$;

revoke all on function cancel_cod_order(text, text, text) from public;
grant execute on function cancel_cod_order(text, text, text) to anon, authenticated;
