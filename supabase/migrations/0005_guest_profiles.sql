-- Cross-device guest profiles, keyed by verified phone number.
--
-- Buyers browse and check out anonymously, so their profile (name, city,
-- delivery address) normally lives only in the browser's localStorage. Once a
-- buyer verifies their phone (Supabase phone OTP), we persist that profile here
-- keyed by the 10-digit phone, and can look their real orders back up by the
-- same phone — bridging the guest-order RLS limit (orders only expose to a
-- matching buyer_id, which guest orders leave null).
--
-- This table is written and read only by the service-role /api/guest-sync
-- endpoint, which trusts the phone from a verified Supabase JWT. RLS is on with
-- no public policies, so the anon/authenticated browser client can never read
-- another phone's row directly.
--
-- Run this once in the Supabase SQL editor after the earlier migrations.

create table if not exists guest_profiles (
  phone text primary key,
  name text,
  city text,
  address text,
  updated_at timestamptz not null default now()
);

alter table guest_profiles enable row level security;
-- No policies on purpose: only the service role (which bypasses RLS) touches it.

-- Fast lookup of a guest's orders by the phone captured at checkout.
create index if not exists orders_guest_phone_idx on orders (guest_phone);
