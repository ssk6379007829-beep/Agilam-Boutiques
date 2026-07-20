-- Offline / walk-in sale billing (POS).
--
-- Offline sales reuse the existing orders/order_items tables (tagged with a
-- new `channel` column) instead of a parallel schema, so Dashboard/Earnings/
-- Analytics/Customers keep working unmodified — they already sum `orders`.
--
-- Run this once in the Supabase SQL editor after 0008.

alter table orders add column if not exists channel text not null default 'online';
do $$ begin
  alter table orders add constraint orders_channel_check check (channel in ('online','offline'));
exception when duplicate_object then null; end $$;

alter table orders add column if not exists payment_method text;

create index if not exists idx_orders_channel on orders (channel);

-- create_offline_sale: atomically records a walk-in sale — one `orders` row,
-- its `order_items`, and a stock decrement per catalog line — as a single
-- SECURITY DEFINER call so a partial failure can't leave stock/items out of
-- sync. Authorization is checked inside the function (caller must own the
-- boutique) rather than via RLS insert policies, mirroring the existing
-- toggle_boutique_follow() RPC pattern.
create or replace function create_offline_sale(
  p_boutique_id uuid,
  p_buyer_name text,
  p_buyer_phone text,
  p_items jsonb, -- [{product_id: uuid|null, title: text, price: numeric, qty: int}]
  p_discount numeric default 0,
  p_payment_method text default 'Cash'
)
returns table (id uuid, order_number text, total numeric, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_order_number text;
  v_subtotal numeric := 0;
  v_total numeric := 0;
  v_item jsonb;
  v_product_id uuid;
  v_qty int;
begin
  if not exists (select 1 from boutiques b where b.id = p_boutique_id and b.owner_id = auth.uid()) then
    raise exception 'Not authorized for this boutique';
  end if;
  if jsonb_array_length(p_items) = 0 then
    raise exception 'At least one item is required';
  end if;

  select coalesce(sum((i->>'price')::numeric * (i->>'qty')::int), 0)
    into v_subtotal
    from jsonb_array_elements(p_items) as i;
  v_total := greatest(0, v_subtotal - coalesce(p_discount, 0));

  v_order_number := 'AGB-' || to_char(now(), 'YYMMDD') || '-' || floor(random() * 9000 + 1000)::text;

  insert into orders (order_number, buyer_id, boutique_id, status, total, guest_name, guest_phone, channel, payment_method)
  values (v_order_number, null, p_boutique_id, 'delivered', v_total, p_buyer_name, p_buyer_phone, 'offline', p_payment_method)
  returning orders.id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_product_id := nullif(v_item->>'product_id', '')::uuid;
    v_qty := coalesce((v_item->>'qty')::int, 1);

    insert into order_items (order_id, product_id, title, price, qty)
    values (v_order_id, v_product_id, v_item->>'title', (v_item->>'price')::numeric, v_qty);

    if v_product_id is not null then
      update products set stock = greatest(0, stock - v_qty)
        where products.id = v_product_id and products.boutique_id = p_boutique_id;
    end if;
  end loop;

  return query select orders.id, orders.order_number, orders.total, orders.created_at
    from orders where orders.id = v_order_id;
end;
$$;

grant execute on function create_offline_sale(uuid, text, text, jsonb, numeric, text) to authenticated;
