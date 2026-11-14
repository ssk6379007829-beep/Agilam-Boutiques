-- 0117 — Tell the admins when a COURIER scan delivers an order, so they settle it.
--
-- Context. Payouts are manual: automatic transfers are switched off (0078a), and
-- an admin settles a boutique's delivered orders in /admin/payments. A DTDC (or
-- other booked-courier) parcel reaches 'delivered' on its OWN scan, through
-- apply_shipment_scan() during the 30-minute reconcile sweep (0115) — no human
-- touches it. That is the point of the integration, but it also means nothing
-- nudges the admin that money is now owed: the order just quietly becomes
-- settleable. This adds that nudge as an admin notification.
--
-- Scope. ONLY booked-courier parcels (provider in dtdc/shiprocket/shadowfax),
-- because those are the ones no person marked delivered. A self-shipped parcel
-- (provider 'manual' / null) is marked delivered by the seller, who is standing
-- right there in /seller/orders — the admin needs no separate ping for it.
--
-- This is a `create or replace function`. The body below is 0067's
-- apply_shipment_scan() as it is live today (verified via pg_get_functiondef
-- 2026-11-14), UNCHANGED except for the two additions marked `-- 0117`:
--   1. v_order_number is read, for the notification text.
--   2. On the delivered TRANSITION, one notification row per active admin.
-- Nothing else is touched. Idempotent; safe to re-run in the Supabase SQL editor.

create or replace function public.apply_shipment_scan(
  p_awb text,
  p_raw_status text,
  p_stage text,
  p_location text default null::text,
  p_occurred_at timestamp with time zone default null::timestamp with time zone,
  p_payload jsonb default null::jsonb
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_ship         shipments;
  v_status       text;
  v_order_number text;   -- 0117
begin
  select * into v_ship from shipments where awb = trim(p_awb) limit 1;
  if v_ship.id is null then
    -- An AWB we never issued. Not an error worth failing the webhook over —
    -- Shiprocket will retry forever on a non-2xx — so record nothing and let
    -- the caller log it.
    return false;
  end if;

  insert into shipment_events (shipment_id, order_id, awb, raw_status, stage, location, occurred_at, payload)
  values (v_ship.id, v_ship.order_id, v_ship.awb, p_raw_status, p_stage, p_location, p_occurred_at, p_payload)
  on conflict do nothing;

  update shipments
     set last_status = p_stage,
         last_status_at = coalesce(p_occurred_at, now())
   where id = v_ship.id;

  select status into v_status from orders where id = v_ship.order_id;

  -- A scan never resurrects a finished order. Cancelled, rejected and refunded
  -- orders are closed books, and a late courier scan must not reopen one.
  if v_status in ('cancelled', 'rejected') then
    return true;
  end if;

  if p_stage = 'out_for_delivery' then
    -- Stage 4 of the buyer's timeline has been decoration since day one because
    -- nothing could honestly set it. This is the only thing that ever can.
    update orders
       set out_for_delivery_at = coalesce(out_for_delivery_at, coalesce(p_occurred_at, now()))
     where id = v_ship.order_id;

  elsif p_stage = 'delivered' then
    -- The whole point. The courier says it arrived, not the seller.
    if v_status is distinct from 'delivered' then
      update orders set status = 'delivered' where id = v_ship.order_id;

      -- 0117. The seller never touched this — a booked courier closed it — so
      -- nothing has told the admin it is now payable. One notification per
      -- active admin, only for booked-courier parcels and only on the actual
      -- transition (we are inside `v_status is distinct from 'delivered'`, so
      -- it fires once). A self-shipped parcel is excluded: the seller marked it.
      if v_ship.provider in ('dtdc', 'shiprocket', 'shadowfax') then
        select order_number into v_order_number from orders where id = v_ship.order_id;
        insert into notifications (profile_id, type, title, body, order_id)
        select p.id,
               'Orders',
               'Delivered — ready to pay out',
               'Order ' || coalesce(v_order_number, '') || ' was delivered by the courier ('
                 || upper(v_ship.provider) || ') and is ready to settle.',
               v_ship.order_id
          from profiles p
         where p.role = 'admin'
           and coalesce(p.status, 'active') = 'active'
           and p.deleted_at is null;
      end if;
    end if;

  elsif p_stage = 'rto' then
    -- Returned to origin: it never reached the buyer, so it must never pay out.
    -- Flagged as a dispute rather than silently cancelled — the money question
    -- (who eats the RTO freight) is an admin's to settle, and 0063 already stops
    -- a disputed order from being swept.
    update orders
       set delivery_disputed = true,
           delivery_disputed_at = coalesce(delivery_disputed_at, now()),
           delivery_dispute_note = coalesce(delivery_dispute_note,
             'Returned to origin by the courier: ' || coalesce(p_raw_status, 'RTO'))
     where id = v_ship.order_id;
  end if;

  return true;
end $function$;
