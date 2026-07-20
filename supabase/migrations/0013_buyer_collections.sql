-- Buyer collections that persist to the account: cart + boutique follows.
--
-- Goal: a signed-in buyer's bag, saved items and followed boutiques live in the
-- database keyed to their auth id, so they come back on any device after a
-- logout/login. Guests keep these locally and the app merges them up on the
-- first sign-in (see src/data/buyerCollections.ts).
--
-- The `wishlist` table already exists in the base schema (schema.sql); this
-- migration only adds the two missing tables and moves the boutique follower
-- count onto a real per-account followers table maintained by a trigger.
--
-- Run this once in the Supabase SQL editor after the earlier migrations.

-- ── Cart ────────────────────────────────────────────────────────────────
-- One row per (buyer, product); the size + quantity the buyer chose. Owned
-- entirely by the buyer via RLS.
create table if not exists cart_items (
  buyer_id uuid not null references profiles(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  qty int not null default 1 check (qty > 0),
  size text not null default 'M',
  updated_at timestamptz not null default now(),
  primary key (buyer_id, product_id)
);

alter table cart_items enable row level security;

drop policy if exists "cart_items: owner manage" on cart_items;
create policy "cart_items: owner manage" on cart_items for all
  using (buyer_id = auth.uid()) with check (buyer_id = auth.uid());

-- ── Boutique followers ─────────────────────────────────────────────────
-- One row per (buyer, boutique). Replaces the anonymous localStorage-only
-- follow: a follow is now a real, per-account row, so "boutiques I follow"
-- restores across devices. The shared boutiques.followers_count is kept in
-- sync by the trigger below (increment on follow, decrement on unfollow), so
-- it always reflects the number of real accounts following.
create table if not exists boutique_followers (
  buyer_id uuid not null references profiles(id) on delete cascade,
  boutique_id uuid not null references boutiques(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (buyer_id, boutique_id)
);

alter table boutique_followers enable row level security;

drop policy if exists "boutique_followers: owner manage" on boutique_followers;
create policy "boutique_followers: owner manage" on boutique_followers for all
  using (buyer_id = auth.uid()) with check (buyer_id = auth.uid());

-- Keep boutiques.followers_count accurate as rows come and go. SECURITY DEFINER
-- so it can update the count past the owner/admin-only boutiques update policy,
-- while only ever touching that one column.
create or replace function sync_boutique_followers_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update boutiques set followers_count = followers_count + 1 where id = new.boutique_id;
  elsif tg_op = 'DELETE' then
    update boutiques set followers_count = greatest(0, followers_count - 1) where id = old.boutique_id;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_boutique_followers_count on boutique_followers;
create trigger trg_boutique_followers_count
  after insert or delete on boutique_followers
  for each row execute function sync_boutique_followers_count();
