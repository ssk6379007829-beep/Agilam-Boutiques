-- Boutique profile (premium) — extra fields the buyer-facing profile page shows.
--
-- The redesigned profile (design mock "09. Boutique Profile Page") surfaces a
-- followers count, a positive-rating percentage, an "established" year, a
-- locality line, and Call / Instagram shortcuts. None of these existed on the
-- boutiques table, so add them here. All are optional with safe defaults, so
-- existing rows and inserts keep working.
--
-- Run this once in the Supabase SQL editor after schema.sql (and after
-- 0001_guest_orders.sql). Re-running is safe.

alter table boutiques add column if not exists area text not null default '';
alter table boutiques add column if not exists phone text;
alter table boutiques add column if not exists instagram text;
alter table boutiques add column if not exists established_year int;
alter table boutiques add column if not exists followers_count int not null default 0;
alter table boutiques add column if not exists positive_rating int not null default 0;

-- Keep the positive-rating a sane percentage.
do $$ begin
  alter table boutiques add constraint boutiques_positive_rating_range
    check (positive_rating between 0 and 100);
exception when duplicate_object then null;
end $$;
