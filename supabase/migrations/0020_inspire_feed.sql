-- Inspire — the boutique feed, built from the catalogue.
--
-- The feed is not a second content system. A boutique lists a piece once, with
-- its photos, price and description, and that listing *is* the post: it appears
-- in the feed of everyone following that shop, newest first. Sellers never
-- upload a separate set of images, and there is nothing extra to keep in sync.
--
-- So the only thing missing from the schema is a public "like" — the heart on a
-- feed card, which is a different gesture from the wishlist (that's the private
-- bookmark, and `wishlist` already covers it).
--
--   products.likes_count — the shared number shown on the card.
--   product_likes        — one row per (product, signed-in buyer), so "posts I
--                          liked" follows the account across devices.
--   toggle_product_like  — the only writer for likes_count.
--
-- Buyers browse anonymously, so liking cannot require an account (same reasoning
-- as boutique follows in 0004). The RPC is SECURITY DEFINER: it moves the shared
-- count for anyone, and additionally records a per-account row when the caller
-- happens to be signed in.
--
-- Idempotent: re-runnable in the Supabase SQL editor. Run after 0019.

-- ── Clean up the earlier separate-posts draft ────────────────────────────────
-- An earlier cut of this migration introduced a standalone `posts` table with
-- its own image uploads. That was replaced by the catalogue-driven feed above,
-- so drop it if it was ever applied. Harmless when it was not.
drop function if exists toggle_post_like(uuid, boolean);
drop table if exists post_saves;
drop table if exists post_likes;
drop table if exists posts;

-- ── Public like count on the product ─────────────────────────────────────────
alter table products add column if not exists likes_count int not null default 0;

create table if not exists product_likes (
  product_id uuid not null references products(id) on delete cascade,
  buyer_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (product_id, buyer_id)
);

alter table product_likes enable row level security;

drop policy if exists "product_likes: owner manage" on product_likes;
create policy "product_likes: owner manage" on product_likes for all
  using (buyer_id = auth.uid()) with check (buyer_id = auth.uid());

-- ── Like toggle ──────────────────────────────────────────────────────────────
-- Returns the new shared count. SECURITY DEFINER so it can write likes_count
-- past the owner/admin-only products update policy, while only ever touching
-- that one column.
--
-- For a signed-in buyer the per-account row is the source of truth and the
-- counter only moves when that row actually changed, so a double-tap (or a
-- retried request) can't inflate it. Guests have no row to key on, so their tap
-- moves the counter directly — the client keeps the per-device state and won't
-- send the same direction twice.
create or replace function toggle_product_like(pid uuid, do_like boolean)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  changed boolean := true;
  new_count int;
begin
  if uid is not null then
    if do_like then
      insert into product_likes (product_id, buyer_id) values (pid, uid) on conflict do nothing;
    else
      delete from product_likes where product_id = pid and buyer_id = uid;
    end if;
    -- FOUND is false when ON CONFLICT DO NOTHING swallowed the insert, or when
    -- the delete matched nothing — i.e. the like state was already what was asked.
    changed := found;
  end if;

  if changed then
    update products
      set likes_count = greatest(0, likes_count + case when do_like then 1 else -1 end)
      where id = pid
      returning likes_count into new_count;
  else
    select likes_count into new_count from products where id = pid;
  end if;

  return coalesce(new_count, 0);
end;
$$;

grant execute on function toggle_product_like(uuid, boolean) to anon, authenticated;

-- ── Feed ordering ────────────────────────────────────────────────────────────
-- The feed is "newest listings from these boutiques", paged by created_at.
create index if not exists products_boutique_created_idx
  on products (boutique_id, created_at desc)
  where status = 'active' and deleted_at is null;

-- ── Realtime ─────────────────────────────────────────────────────────────────
-- So an open feed sees like counts move as others tap. Guarded — re-adding a
-- table to the publication errors otherwise.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'products'
  ) then
    alter publication supabase_realtime add table products;
  end if;
end $$;

-- The `post-images` bucket from the earlier draft is no longer used; feed photos
-- are the product's own, already in `product-images`. Dropping a bucket with
-- objects in it errors, so this only clears the policies and leaves an empty
-- bucket behind — harmless, and safe to delete by hand in the dashboard.
drop policy if exists "post-images: public read"   on storage.objects;
drop policy if exists "post-images: authed upload" on storage.objects;
drop policy if exists "post-images: authed update" on storage.objects;
drop policy if exists "post-images: authed delete" on storage.objects;
