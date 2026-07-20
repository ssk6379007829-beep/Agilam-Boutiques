-- Atomic stock reservation for order placement (H-03: prevent overselling).
--
-- api/place-order.js calls reserve_stock() after the payment is verified and
-- before the orders are written. Postgres runs the whole function body in one
-- transaction, so the decrement is all-or-nothing: if ANY line lacks stock the
-- function raises and nothing is left decremented. Under concurrency the
-- `stock >= q` guard is re-checked against the row after the competing update
-- commits (READ COMMITTED EvalPlanQual), so two buyers can't both take the last
-- unit. release_stock() reverses a reservation if the order rows fail to write.
--
-- p_items is a JSON array of { product_id: <uuid>, qty: <int> }.
-- Run once in the Supabase SQL editor after 0001–0010.

create or replace function reserve_stock(p_items jsonb)
returns void
language plpgsql
as $$
declare
  it jsonb;
  pid uuid;
  q int;
begin
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    pid := (it->>'product_id')::uuid;
    q := greatest(1, coalesce((it->>'qty')::int, 1));
    update products
      set stock = stock - q
      where id = pid and stock >= q;
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
begin
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    update products
      set stock = stock + greatest(1, coalesce((it->>'qty')::int, 1))
      where id = (it->>'product_id')::uuid;
  end loop;
end;
$$;
