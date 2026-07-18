-- Guest checkout: let anonymous buyers place real orders.
--
-- Buyers browse without an account (see AuthContext), so orders can't carry an
-- authenticated buyer_id. Orders are instead created server-side by
-- api/place-order.js using the Supabase service role, which captures the guest's
-- contact details and (for online payments) the verified Razorpay payment id.
--
-- Run this once in the Supabase SQL editor after schema.sql.

-- buyer_id is no longer required — guest orders leave it null.
alter table orders alter column buyer_id drop not null;

-- Guest contact + payment metadata carried on the order itself.
alter table orders add column if not exists guest_name text;
alter table orders add column if not exists guest_phone text;
alter table orders add column if not exists guest_city text;
alter table orders add column if not exists guest_address text;
alter table orders add column if not exists payment_id text;

-- Sellers keep reading their orders via the existing boutique-scoped policy
-- (orders: buyer or seller or admin read), which matches on boutique ownership
-- and is unaffected by a null buyer_id. No policy change is required: the
-- service role used by api/place-order.js bypasses RLS for the insert.
