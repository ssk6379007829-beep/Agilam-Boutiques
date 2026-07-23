-- Product engagement — the buyer-side signals a seller wants to read per product.
--
-- The seller console asks for Views, Shares and Wishlist saves next to every
-- product, plus a "last viewed" timestamp. None of that existed:
--   • Views/shares were never recorded anywhere.
--   • Wishlist saves live in `wishlist`, which is owner-only under RLS — a seller
--     can never aggregate another account's rows, so a raw count is impossible
--     from the client.
--
-- This migration denormalises all three onto `products`, the one table the
-- seller can already read for their own catalogue:
--   products.views_count     — times a buyer opened the product page
--   products.shares_count     — times a buyer shared the product
--   products.wishlist_count   — buyers who currently have it saved
--   products.last_viewed_at   — most recent view
--
-- Views and shares are moved by SECURITY DEFINER RPCs (buyers browse
-- anonymously, so, like likes in 0020, the write can't require an account).
-- Wishlist count is trigger-maintained off the `wishlist` table. As with the
-- sales counters in 0023, none of these columns are app-writable — a guard
-- trigger reverts any change made outside the privileged paths, so a seller
-- can't inflate their own numbers with a plain UPDATE.
--
-- Idempotent: re-runnable in the Supabase SQL editor. Run after 0023.

-- ── Columns ─────────────────────────────────────────────────────────────────
alter table products add column if not exists views_count    integer not null default 0;
alter table products add column if not exists shares_count   integer not null default 0;
alter table products add column if not exists wishlist_count integer not null default 0;
alter table products add column if not exists last_viewed_at timestamptz;

create index if not exists idx_products_views_count on products (views_count desc);

-- ── Privileged-write flag ───────────────────────────────────────────────────
-- Same shape as 0023's sales flag, on its own key so the two guards never
-- clobber each other. The functions that flip it are SECURITY DEFINER; nothing
-- the app can call sets it.
create or replace function engagement_counters_begin() returns void
language sql security definer set search_path = public
as $$ select set_config('agilam.engagement', 'on', true) $$;

create or replace function engagement_counters_end() returns void
language sql security definer set search_path = public
as $$ select set_config('agilam.engagement', 'off', true) $$;

revoke execute on function engagement_counters_begin() from public, anon, authenticated;
revoke execute on function engagement_counters_end() from public, anon, authenticated;

-- ── Record a view ───────────────────────────────────────────────────────────
-- Bumps the counter and stamps last_viewed_at. The client throttles to one call
-- per product per session, so this is "sessions that opened the page", which is
-- the honest reading of a view number and can't be inflated by a re-render.
create or replace function record_product_view(pid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform engagement_counters_begin();
  update products
     set views_count = views_count + 1,
         last_viewed_at = now()
   where id = pid and deleted_at is null;
  perform engagement_counters_end();
end $$;

-- ── Record a share ──────────────────────────────────────────────────────────
create or replace function record_product_share(pid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform engagement_counters_begin();
  update products
     set shares_count = shares_count + 1
   where id = pid and deleted_at is null;
  perform engagement_counters_end();
end $$;

grant execute on function record_product_view(uuid)  to anon, authenticated;
grant execute on function record_product_share(uuid) to anon, authenticated;

-- ── Wishlist count · trigger-maintained ─────────────────────────────────────
-- Saving/removing a piece moves the shared count on the product, so a seller
-- reads it straight off their catalogue row. greatest(0, …) mirrors 0023: a
-- display number should never render negative even if the two ever drift.
create or replace function wishlist_apply_counter()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row  record := case when tg_op = 'DELETE' then old else new end;
  v_sign integer := case when tg_op = 'DELETE' then -1 else 1 end;
begin
  perform engagement_counters_begin();
  update products
     set wishlist_count = greatest(0, wishlist_count + v_sign)
   where id = v_row.product_id;
  perform engagement_counters_end();
  return v_row;
end $$;

drop trigger if exists wishlist_apply_counter on wishlist;
create trigger wishlist_apply_counter
  after insert or delete on wishlist
  for each row execute function wishlist_apply_counter();

-- ── Guard · these columns are not app-writable ──────────────────────────────
-- Without this, a seller who owns the row could `update products set
-- views_count = 99999` — RLS allows the row and nothing else was checking the
-- columns. Reverts any change made outside the privileged paths above.
create or replace function products_guard_engagement()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(current_setting('agilam.engagement', true), 'off') <> 'on' then
    new.views_count    := old.views_count;
    new.shares_count   := old.shares_count;
    new.wishlist_count := old.wishlist_count;
    new.last_viewed_at := old.last_viewed_at;
  end if;
  return new;
end $$;

drop trigger if exists products_guard_engagement on products;
create trigger products_guard_engagement
  before update on products
  for each row execute function products_guard_engagement();

-- ── Backfill ────────────────────────────────────────────────────────────────
-- Recompute wishlist_count from the live wishlist rows. One DO block so the
-- privileged flag (transaction-local) survives across the UPDATEs — see the
-- same note in 0023's backfill. Views/shares have no history to recover, so
-- they legitimately start at zero.
do $$
begin
  perform engagement_counters_begin();
  update products set wishlist_count = 0 where wishlist_count <> 0;
  update products p
     set wishlist_count = agg.n
    from (select product_id, count(*)::int as n from wishlist group by product_id) agg
   where p.id = agg.product_id;
  perform engagement_counters_end();
end $$;
