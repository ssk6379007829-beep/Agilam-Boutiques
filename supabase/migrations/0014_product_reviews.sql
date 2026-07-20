-- Product reviews & ratings — turn the rating/reviews_count columns that already
-- exist on products and boutiques into real, buyer-generated data.
--
-- Before this migration those aggregate columns held only seed values and there
-- was no `reviews` table or way for a buyer to leave feedback (audit finding).
-- This adds:
--   • a `reviews` table (one row per buyer per product, RLS-guarded),
--   • public read of reviews for approved boutiques' products,
--   • a trigger that recomputes products.rating / products.reviews_count and
--     rolls the same aggregate up onto the boutique, so the numbers the buyer
--     app already displays become live.
--
-- Additive and idempotent. Run once in the Supabase SQL editor after 0001–0013.

create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  boutique_id uuid not null references boutiques(id) on delete cascade,
  buyer_id uuid not null references profiles(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  body text not null default '',
  author_name text,
  -- Set true when the buyer has a delivered order containing this product.
  verified_purchase boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One review per buyer per product; re-submitting updates the same row.
  unique (product_id, buyer_id)
);

create index if not exists reviews_product_idx on reviews (product_id, created_at desc);
create index if not exists reviews_boutique_idx on reviews (boutique_id);

alter table reviews enable row level security;

-- Anyone (including anonymous buyers) can read reviews for a product whose
-- boutique is approved — reviews are public content, like the products.
drop policy if exists "reviews: public read" on reviews;
create policy "reviews: public read" on reviews for select
  using (
    exists (select 1 from boutiques b where b.id = boutique_id and b.status = 'approved')
    or exists (select 1 from boutiques b where b.id = boutique_id and b.owner_id = auth.uid())
    or is_admin()
  );

-- A signed-in buyer manages only their own reviews.
drop policy if exists "reviews: owner write" on reviews;
create policy "reviews: owner write" on reviews for all
  using (buyer_id = auth.uid()) with check (buyer_id = auth.uid());

-- Recompute the product's average rating + count from its reviews, then roll the
-- boutique's aggregate up from all its products. SECURITY DEFINER so the trigger
-- can update products/boutiques past their owner-only write policies while only
-- ever touching the rating + reviews_count columns.
create or replace function recompute_review_aggregates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product uuid := coalesce(new.product_id, old.product_id);
  v_boutique uuid := coalesce(new.boutique_id, old.boutique_id);
begin
  update products p
    set rating = coalesce((select round(avg(r.rating)::numeric, 1) from reviews r where r.product_id = v_product), 0),
        reviews_count = (select count(*) from reviews r where r.product_id = v_product)
    where p.id = v_product;

  update boutiques b
    set rating = coalesce((select round(avg(r.rating)::numeric, 1) from reviews r where r.boutique_id = v_boutique), 0),
        reviews_count = (select count(*) from reviews r where r.boutique_id = v_boutique),
        positive_rating = coalesce((
          select round(100.0 * count(*) filter (where r.rating >= 4) / nullif(count(*), 0))
          from reviews r where r.boutique_id = v_boutique
        ), 0)
    where b.id = v_boutique;

  return null;
end;
$$;

drop trigger if exists trg_recompute_review_aggregates on reviews;
create trigger trg_recompute_review_aggregates
  after insert or update or delete on reviews
  for each row execute function recompute_review_aggregates();
