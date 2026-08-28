-- Colour sets and per-size stock.
--
-- Two seller-side changes that meet on the same table.
--
-- 1. COLOUR SETS. A shop that stitches the same kurta in four colours had to
--    list four unrelated products; nothing tied them together, so a buyer who
--    found the green one never learned the maroon existed. Each colour stays
--    its OWN row on purpose — its own photos, price, stock, slug, reviews and
--    analytics — and `variant_group_id` is the only new thread between them.
--    Nothing about cart, checkout, pricing, payouts or search changes.
--
-- 2. PER-SIZE STOCK. `products.stock` was one pooled number for every size, so
--    a kurta with 2 pieces left could be sold as an XL that ran out weeks ago.
--    `size_stock` holds the breakdown: {"S": 3, "M": 5, "L": 0}.
--
--    It is NULL on every existing product, and NULL means "pooled, exactly as
--    before". Splitting a seller's pooled 12 across four sizes would invent
--    stock they may not have on the shelf — a buyer would order an L nobody can
--    post. So nothing is backfilled: the seller form requires the split from
--    now on, and each product converts the first time its owner saves it.
--
-- `products.stock` STAYS the authoritative total either way — the sync trigger
-- below keeps it equal to the sum of the map. So every existing reader of
-- `stock` (the buyer's "Low · 2 left", ShopContext's stockLimit, the seller
-- catalogue, the admin console, the 0023 sales counters, the daily digest)
-- keeps working with no change at all.
--
-- Idempotent. Apply after 0100/0102.

-- ── Columns ──────────────────────────────────────────────────────────────────

alter table products add column if not exists variant_group_id uuid;
alter table products add column if not exists size_stock jsonb;

comment on column products.variant_group_id is
  'Ties this product to its other colours. Every row sharing the id is the same
   piece in a different colour, and each keeps its own photos, price and stock.';
comment on column products.size_stock is
  'Per-size stock, e.g. {"S":3,"M":5}. NULL = pooled on products.stock (legacy).
   products.stock is kept equal to the sum of this map by trigger.';

-- Partial: the vast majority of products are not in a colour set, and the only
-- query is "the other colours in THIS group".
create index if not exists products_variant_group_idx
  on products (variant_group_id)
  where variant_group_id is not null;

-- ── A colour set cannot span two boutiques ───────────────────────────────────
--
-- RLS already stops a seller writing another shop's product, but nothing stops
-- them writing their OWN product's group id to a group belonging to someone
-- else — which would hang their item off a competitor's product page as if the
-- competitor stitched it. SECURITY DEFINER because the check has to see rows
-- the caller may not: an unapproved shop's products are invisible to them, and
-- an existence check that returns "no rows" would wave the injection through.

create or replace function products_variant_group_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.variant_group_id is not null and exists (
    select 1
      from products p
     where p.variant_group_id = new.variant_group_id
       and p.id <> new.id
       and p.boutique_id <> new.boutique_id
  ) then
    raise exception 'VARIANT_GROUP_CROSS_BOUTIQUE: a colour set cannot span two boutiques'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_products_variant_group_guard on products;
create trigger trg_products_variant_group_guard
  before insert or update of variant_group_id on products
  for each row execute function products_variant_group_guard();

-- ── Keeping products.stock equal to the sum of the map ───────────────────────

create or replace function products_size_stock_sync()
returns trigger
language plpgsql
as $$
declare
  e record;
  v_delta int;
  v_key text;
  v_val int;
  v_total int;
begin
  -- An empty map is not a map. A seller who unticks every size drops back to
  -- the single pooled number rather than to "zero of everything".
  if new.size_stock = '{}'::jsonb then
    new.size_stock := null;
  end if;

  if new.size_stock is null then
    return new;  -- pooled: `stock` is whatever was written, exactly as before.
  end if;

  -- jsonb will happily hold "abc" or 2.5, and the sum at the bottom would then
  -- raise a bare cast error from inside a trigger with nothing naming the size.
  for e in select key, value from jsonb_each_text(new.size_stock) loop
    if e.value !~ '^[0-9]+$' then
      raise exception 'SIZE_STOCK_INVALID: "%" is not a whole number of pieces for size %', e.value, e.key
        using errcode = 'check_violation';
    end if;
  end loop;

  -- A write that moved `stock` WITHOUT touching the map has to be pushed down
  -- into the buckets, or the recomputation below would silently hand the units
  -- straight back. An offline sale (0052) and an admin stock edit both do
  -- exactly this, and neither knows which size went out of the door — so a sale
  -- comes off the fullest size and a return goes onto the emptiest. The total
  -- is always right; the seller can correct the split in their product form.
  if tg_op = 'UPDATE'
     and old.size_stock is not distinct from new.size_stock
     and new.stock <> old.stock then
    v_delta := new.stock - old.stock;
    while v_delta <> 0 loop
      v_key := null;
      if v_delta < 0 then
        select k.key, k.value::int into v_key, v_val
          from jsonb_each_text(new.size_stock) k
         where k.value::int > 0
         order by k.value::int desc, k.key
         limit 1;
        exit when v_key is null;  -- every bucket empty; nothing left to take
        v_val := v_val - 1;
        v_delta := v_delta + 1;
      else
        select k.key, k.value::int into v_key, v_val
          from jsonb_each_text(new.size_stock) k
         order by k.value::int asc, k.key
         limit 1;
        exit when v_key is null;
        v_val := v_val + 1;
        v_delta := v_delta - 1;
      end if;
      new.size_stock := jsonb_set(new.size_stock, array[v_key], to_jsonb(v_val));
    end loop;
  end if;

  select coalesce(sum(k.value::int), 0) into v_total from jsonb_each_text(new.size_stock) k;
  new.stock := v_total;
  return new;
end;
$$;

drop trigger if exists trg_products_size_stock_sync on products;
create trigger trg_products_size_stock_sync
  before insert or update on products
  for each row execute function products_size_stock_sync();

-- ── Reservation, now size-aware ──────────────────────────────────────────────
--
-- Replaces the 0011 pair. p_items gains an optional `size`:
--   [{ product_id: <uuid>, qty: <int>, size: "M" }]
--
-- A product with no map, or a line with no size, or a size the seller does not
-- stock, takes the original pooled path — so this is a no-op for every product
-- until its seller splits their stock. Still one transaction and still
-- all-or-nothing: if ANY line is short, the whole reservation raises and
-- nothing is left decremented.

create or replace function reserve_stock(p_items jsonb)
returns void
language plpgsql
as $$
declare
  it jsonb;
  pid uuid;
  q int;
  sz text;
  sized boolean;
begin
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    pid := (it->>'product_id')::uuid;
    q := greatest(1, coalesce((it->>'qty')::int, 1));
    sz := nullif(btrim(coalesce(it->>'size', '')), '');

    -- One locked look at the row decides which path this line takes, so a
    -- seller saving their stock split mid-checkout cannot land us between the
    -- two. NULL (no such product) falls through to the raise below.
    select (p.size_stock is not null and sz is not null and p.size_stock ? sz)
      into sized
      from products p
     where p.id = pid
       for update;

    if sized is null then
      raise exception 'INSUFFICIENT_STOCK:%', pid using errcode = 'check_violation';
    end if;

    if sized then
      -- Only the map is written; the sync trigger derives products.stock.
      update products
         set size_stock = jsonb_set(size_stock, array[sz], to_jsonb((size_stock->>sz)::int - q))
       where id = pid
         and coalesce((size_stock->>sz)::int, 0) >= q;
    else
      update products
         set stock = stock - q
       where id = pid and stock >= q;
    end if;

    if not found then
      raise exception 'INSUFFICIENT_STOCK:%', pid using errcode = 'check_violation';
    end if;
  end loop;
end;
$$;

create or replace function release_stock(p_items jsonb)
returns void
language plpgsql
as $$
declare
  it jsonb;
  pid uuid;
  q int;
  sz text;
  sized boolean;
begin
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    pid := (it->>'product_id')::uuid;
    q := greatest(1, coalesce((it->>'qty')::int, 1));
    sz := nullif(btrim(coalesce(it->>'size', '')), '');

    select (p.size_stock is not null and sz is not null and p.size_stock ? sz)
      into sized
      from products p
     where p.id = pid
       for update;

    -- Best-effort by design, as in 0011: a release chases a failed write, and
    -- raising here would bury the error that actually matters.
    if sized is null then
      continue;
    end if;

    if sized then
      update products
         set size_stock = jsonb_set(size_stock, array[sz], to_jsonb((size_stock->>sz)::int + q))
       where id = pid;
    else
      update products
         set stock = stock + q
       where id = pid;
    end if;
  end loop;
end;
$$;
