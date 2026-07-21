-- Fix: seller product photo upload fails with
--   "new row violates row-level security policy"
--
-- Cause: the `product-images` bucket exists (often created from the dashboard)
-- but the storage.objects INSERT policy from migration 0008 was never applied,
-- so RLS denies every upload. This migration re-establishes the bucket and the
-- storage policies from scratch, so it is safe to run regardless of the project's
-- current state (it drops the old policies by name first, then recreates them).
--
-- Fully idempotent: re-runnable in the Supabase SQL editor.

-- ── Ensure the bucket exists and is public (buyers read photos anonymously) ──
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

-- ── Recreate storage RLS policies cleanly ────────────────────────────────────
-- Objects live under `{boutique_id}/{file}` so ownership is checked from the
-- path alone: the uploader must own the boutique named by the first folder.
drop policy if exists "product-images: public read"  on storage.objects;
drop policy if exists "product-images: owner upload"  on storage.objects;
drop policy if exists "product-images: owner delete"  on storage.objects;
drop policy if exists "product-images: owner update"  on storage.objects;

-- Anyone can read (public bucket / buyer PDP).
create policy "product-images: public read" on storage.objects for select
  using (bucket_id = 'product-images');

-- A signed-in seller may upload into their own boutique's folder.
create policy "product-images: owner upload" on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'product-images'
    and exists (
      select 1 from boutiques b
      where b.owner_id = auth.uid()
        and (storage.foldername(name))[1] = b.id::text
    )
  );

-- Allow overwrite/replace of an owned object (upsert paths use UPDATE).
create policy "product-images: owner update" on storage.objects for update
  to authenticated
  using (
    bucket_id = 'product-images'
    and exists (
      select 1 from boutiques b
      where b.owner_id = auth.uid()
        and (storage.foldername(name))[1] = b.id::text
    )
  );

-- A seller may delete their own boutique's photos.
create policy "product-images: owner delete" on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'product-images'
    and exists (
      select 1 from boutiques b
      where b.owner_id = auth.uid()
        and (storage.foldername(name))[1] = b.id::text
    )
  );
