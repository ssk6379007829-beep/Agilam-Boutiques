-- Product detail completeness — real description/photos/sizes/MRP/wash-care
-- so the seller's Add/Edit Product form can capture what the buyer PDP shows,
-- instead of the buyer page rendering hardcoded placeholder data.
--
-- Fully additive and idempotent: safe to run once in the Supabase SQL editor
-- after 0001–0007. Existing rows get harmless defaults, nothing is dropped.

-- ── Products: richer buyer-facing detail ─────────────────────────────────────
alter table products add column if not exists description text not null default '';
alter table products add column if not exists mrp numeric(10,2);
alter table products add column if not exists sizes text[] not null default '{}';
alter table products add column if not exists wash_care text not null default '';
-- Gallery images in addition to the existing single `image_url` cover shot.
alter table products add column if not exists images text[] not null default '{}';

-- ── Storage: product photo uploads ────────────────────────────────────────────
-- Objects are stored under `{boutique_id}/{filename}` so ownership can be
-- checked from the path alone (mirrors the owner-check pattern already used
-- for products/boutiques row policies below).
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

do $$ begin
  create policy "product-images: public read" on storage.objects for select
    using (bucket_id = 'product-images');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "product-images: owner upload" on storage.objects for insert
    with check (
      bucket_id = 'product-images'
      and exists (
        select 1 from boutiques b
        where b.owner_id = auth.uid() and (storage.foldername(name))[1] = b.id::text
      )
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "product-images: owner delete" on storage.objects for delete
    using (
      bucket_id = 'product-images'
      and exists (
        select 1 from boutiques b
        where b.owner_id = auth.uid() and (storage.foldername(name))[1] = b.id::text
      )
    );
exception when duplicate_object then null; end $$;
