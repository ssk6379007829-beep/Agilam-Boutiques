-- Payment reconciliation log for the Razorpay webhook backstop
-- (api/razorpay-webhook.js).
--
-- The happy path confirms payments synchronously in api/place-order.js, so this
-- table is only written when a payment is captured but no order was created
-- (e.g. the buyer's browser died before place-order ran). The webhook records
-- the captured-but-unfulfilled payment here for an operator to refund or fulfil.
--
-- Not read by the buyer app; service-role only. Additive and idempotent.
-- Run once in the Supabase SQL editor after 0001–0014.

create table if not exists payment_events (
  payment_id text primary key,
  order_ref text,
  event_type text,
  amount int,
  status text not null default 'captured_unfulfilled',
  raw jsonb,
  created_at timestamptz not null default now()
);

alter table payment_events enable row level security;

-- No anon/buyer/seller access. The webhook writes with the service role (which
-- bypasses RLS); admins may review via the console.
drop policy if exists "payment_events: admin read" on payment_events;
create policy "payment_events: admin read" on payment_events for select
  using (is_admin());
