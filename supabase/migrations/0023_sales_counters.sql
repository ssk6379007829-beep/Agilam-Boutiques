-- Sales counters — the signal behind "Best sellers" and "Best-selling boutiques".
--
-- Until now the discovery rails on Home ranked by `reviews_count`, because that
-- was the only popularity-ish number a buyer could actually read. Units sold
-- live in `order_items`, and `order_items` is readable only by the buyer who
-- placed the order and the seller who received it — an anonymous shopper
-- browsing the catalogue can never aggregate it. So "Best sellers" really meant
-- "most reviewed", which rewards old listings and boutiques whose customers
-- happen to write reviews.
--
-- This migration denormalises the number onto the two tables buyers *can* read:
--   products.sold_count    — units of this piece sold
--   boutiques.units_sold   — units sold across the shop
--   boutiques.orders_count — orders the shop has fulfilled
--
-- They are maintained by triggers, never by the app, and the app is not allowed
-- to write them (see the guard triggers at the bottom) — otherwise a seller
-- could put their own product at the top of Best sellers with one UPDATE.
--
-- Idempotent: re-runnable in the Supabase SQL editor.

-- ── Columns ─────────────────────────────────────────────────────────────────
alter table products  add column if not exists sold_count   integer not null default 0;
alter table boutiques add column if not exists units_sold   integer not null default 0;
alter table boutiques add column if not exists orders_count integer not null default 0;

-- Ranking reads sold_count on every catalogue fetch; a plain b-tree is enough
-- to keep the "top N sellers" query off a sequential scan as the catalogue grows.
create index if not exists idx_products_sold_count on products (sold_count desc);

-- ── What counts as a sale ───────────────────────────────────────────────────
-- A `pending` order is a request the seller has not agreed to yet, and
-- `rejected`/`cancelled` orders never happened as far as the shop floor is
-- concerned. Counting from `accepted` onwards means the number a buyer sees is
-- "pieces this boutique actually agreed to sell", which is the honest reading of
-- a best-seller badge. Offline/walk-in bills (migration 0009) are written
-- straight to `delivered`, so they count from the moment they are rung up.
create or replace function order_counts_as_sale(p_status text)
returns boolean
language sql
immutable
as $$ select p_status in ('accepted', 'shipped', 'delivered') $$;

-- ── Counter writes are privileged ───────────────────────────────────────────
-- The trigger functions below flip this transaction-local flag around their
-- writes; the guard triggers reject counter changes made without it. Nothing in
-- the app can set it, because nothing in the app can call `set_config` — the
-- functions that do are SECURITY DEFINER and owned by the table owner.
create or replace function sales_counters_begin() returns void
language sql security definer set search_path = public
as $$ select set_config('agilam.sales_counters', 'on', true) $$;

create or replace function sales_counters_end() returns void
language sql security definer set search_path = public
as $$ select set_config('agilam.sales_counters', 'off', true) $$;

revoke execute on function sales_counters_begin() from public, anon, authenticated;
revoke execute on function sales_counters_end() from public, anon, authenticated;

-- ── Applying an order's items to the counters ───────────────────────────────
-- `p_sign` is +1 when an order enters a counting state and -1 when it leaves
-- one (a delivered order that is later cancelled must give its units back).
-- greatest(0, …) is belt and braces: the counters are a display number, and a
-- negative one on screen would be worse than a slightly stale one.
create or replace function apply_sale_delta(p_order_id uuid, p_sign integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform sales_counters_begin();

  update products p
     set sold_count = greatest(0, p.sold_count + p_sign * s.qty)
    from (
      select oi.product_id, sum(oi.qty)::int as qty
        from order_items oi
       where oi.order_id = p_order_id
         and oi.product_id is not null
       group by oi.product_id
    ) s
   where p.id = s.product_id;

  update boutiques b
     set units_sold = greatest(0, b.units_sold + p_sign * s.qty)
    from (
      select o.boutique_id, sum(oi.qty)::int as qty
        from order_items oi
        join orders o on o.id = oi.order_id
       where oi.order_id = p_order_id
       group by o.boutique_id
    ) s
   where b.id = s.boutique_id;

  perform sales_counters_end();
end $$;

-- SECURITY DEFINER plus the default PUBLIC execute grant would hand every
-- signed-in seller a "add 500 to my own counters" RPC. Only the triggers call it.
revoke execute on function apply_sale_delta(uuid, integer) from public, anon, authenticated;

-- ── Trigger 1 · items added to an order that already counts ─────────────────
-- Order of writes differs by channel: an online order is inserted `pending` and
-- its items follow, then a seller accepts it (trigger 2 picks that up). An
-- offline bill inserts the order as `delivered` *first* and then its items, so
-- without this trigger a walk-in sale would never be counted.
create or replace function order_items_apply_counter()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row      record;
  v_status   text;
  v_boutique uuid;
  v_sign     integer;
begin
  v_row  := case when tg_op = 'DELETE' then old else new end;
  v_sign := case when tg_op = 'DELETE' then -1 else 1 end;

  select o.status, o.boutique_id into v_status, v_boutique
    from orders o where o.id = v_row.order_id;

  if v_status is null or not order_counts_as_sale(v_status) then
    return v_row;
  end if;

  perform sales_counters_begin();

  if v_row.product_id is not null then
    update products
       set sold_count = greatest(0, sold_count + v_sign * v_row.qty)
     where id = v_row.product_id;
  end if;

  update boutiques
     set units_sold = greatest(0, units_sold + v_sign * v_row.qty)
   where id = v_boutique;

  perform sales_counters_end();
  return v_row;
end $$;

drop trigger if exists order_items_apply_counter on order_items;
create trigger order_items_apply_counter
  after insert or delete on order_items
  for each row execute function order_items_apply_counter();

-- ── Trigger 2 · an order crosses into (or out of) a counting state ──────────
create or replace function orders_apply_counter()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  -- CASE rather than `tg_op = 'UPDATE' and …`: on INSERT there is no OLD row,
  -- and touching old.status there raises "record old is not assigned yet".
  was_sale constant boolean := case when tg_op = 'UPDATE' then order_counts_as_sale(old.status) else false end;
  is_sale  constant boolean := order_counts_as_sale(new.status);
begin
  if was_sale = is_sale then
    return new;
  end if;

  perform sales_counters_begin();
  update boutiques
     set orders_count = greatest(0, orders_count + case when is_sale then 1 else -1 end)
   where id = new.boutique_id;
  perform sales_counters_end();

  -- On INSERT the items do not exist yet, so trigger 1 owns the unit counts;
  -- on UPDATE they do, and the whole order moves at once.
  if tg_op = 'UPDATE' then
    perform apply_sale_delta(new.id, case when is_sale then 1 else -1 end);
  end if;

  return new;
end $$;

drop trigger if exists orders_apply_counter on orders;
create trigger orders_apply_counter
  after insert or update of status on orders
  for each row execute function orders_apply_counter();

-- ── Guards · the counters are not app-writable ──────────────────────────────
-- Without these, `update products set sold_count = 9999 where id = <mine>` is a
-- legal statement for the seller who owns the row — the RLS policy allows the
-- row, and nothing was checking the column. Admins are not exempt either: a
-- hand-edited counter would silently disagree with `order_items` forever.
create or replace function products_guard_sales_counter()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(current_setting('agilam.sales_counters', true), 'off') <> 'on' then
    new.sold_count := old.sold_count;
  end if;
  return new;
end $$;

drop trigger if exists products_guard_sales_counter on products;
create trigger products_guard_sales_counter
  before update on products
  for each row execute function products_guard_sales_counter();

create or replace function boutiques_guard_sales_counters()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(current_setting('agilam.sales_counters', true), 'off') <> 'on' then
    new.units_sold   := old.units_sold;
    new.orders_count := old.orders_count;
  end if;
  return new;
end $$;

drop trigger if exists boutiques_guard_sales_counters on boutiques;
create trigger boutiques_guard_sales_counters
  before update on boutiques
  for each row execute function boutiques_guard_sales_counters();

-- ── Backfill ────────────────────────────────────────────────────────────────
-- Full recompute rather than an incremental patch, so re-running this migration
-- also repairs any drift.
--
-- It has to be one DO block, not a run of top-level statements: the guard flag
-- is transaction-local, and outside an explicit transaction it would be
-- discarded the moment `select sales_counters_begin()` returned — leaving the
-- guard triggers to silently revert every UPDATE below and the counters at zero.
do $$
begin
  perform sales_counters_begin();

  update products set sold_count = 0 where sold_count <> 0;
  update products p
     set sold_count = agg.qty
    from (
      select oi.product_id, sum(oi.qty)::int as qty
        from order_items oi
        join orders o on o.id = oi.order_id
       where oi.product_id is not null
         and order_counts_as_sale(o.status)
       group by oi.product_id
    ) agg
   where p.id = agg.product_id;

  update boutiques set units_sold = 0, orders_count = 0 where units_sold <> 0 or orders_count <> 0;
  update boutiques b
     set units_sold = agg.qty
    from (
      select o.boutique_id, sum(oi.qty)::int as qty
        from order_items oi
        join orders o on o.id = oi.order_id
       where order_counts_as_sale(o.status)
       group by o.boutique_id
    ) agg
   where b.id = agg.boutique_id;

  update boutiques b
     set orders_count = agg.n
    from (
      select o.boutique_id, count(*)::int as n
        from orders o
       where order_counts_as_sale(o.status)
       group by o.boutique_id
    ) agg
   where b.id = agg.boutique_id;

  perform sales_counters_end();
end $$;

-- ── Column grants ───────────────────────────────────────────────────────────
-- `products` still carries a table-level SELECT grant, so sold_count is visible
-- there already. `boutiques` was locked down column by column in 0021 — a
-- column that is not named here is invisible to buyers, which is the intent, so
-- the two new counters have to be handed back explicitly.
grant select (units_sold, orders_count) on boutiques to anon;
grant select (units_sold, orders_count) on boutiques to authenticated;
