-- Persist a buyer's delivery address on their profile.
--
-- The buyer profile edit captures name, phone, city and a delivery address, but
-- `profiles` only had the first three — so the address couldn't survive a
-- re-login on another device. Add it here so cross-device sync round-trips the
-- full set. Covered by the existing "profiles: self update/select" policies.
--
-- Run this once in the Supabase SQL editor after the earlier migrations.

alter table profiles add column if not exists address text;
