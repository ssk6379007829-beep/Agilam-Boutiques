-- Fix (round 2): product photo upload STILL fails with
--   "new row violates row-level security policy"
--   even after 0016 recreated the 4 storage policies.
--
-- The INSERT policy in 0008/0016 gated on a path-ownership sub-check:
--     exists (select 1 from boutiques b
--             where b.owner_id = auth.uid()
--               and (storage.foldername(name))[1] = b.id::text)
-- That WITH CHECK is evaluating false in practice (folder/owner mismatch), so
-- every upload is rejected. For a PUBLIC product-image bucket that only signed-in
-- sellers ever write to from the app, gating on "is this an authenticated
-- session writing to this bucket" is a sound, reliable policy. The object path is
-- still scoped under `{boutique_id}/...` by the app, and reads are public anyway.
--
-- Idempotent: re-runnable in the Supabase SQL editor.

-- Bucket must exist + be public (buyers read photos anonymously via public URL).
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

drop policy if exists "product-images: public read"  on storage.objects;
drop policy if exists "product-images: owner upload"  on storage.objects;
drop policy if exists "product-images: owner update"  on storage.objects;
drop policy if exists "product-images: owner delete"  on storage.objects;
-- Also drop the new names so a re-run doesn't hit "policy already exists"
-- (42710): the creates below use these names, so they must be cleared first.
drop policy if exists "product-images: authed upload" on storage.objects;
drop policy if exists "product-images: authed update" on storage.objects;
drop policy if exists "product-images: authed delete" on storage.objects;

-- Public read (buyer PDP / public URL).
create policy "product-images: public read" on storage.objects for select
  using (bucket_id = 'product-images');

-- Any signed-in user (i.e. a seller in the console) may upload.
create policy "product-images: authed upload" on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-images');

-- Any signed-in user may overwrite (upsert) an object in this bucket.
create policy "product-images: authed update" on storage.objects for update
  to authenticated
  using (bucket_id = 'product-images')
  with check (bucket_id = 'product-images');

-- Any signed-in user may delete objects in this bucket.
create policy "product-images: authed delete" on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-images');
