-- Boutique branding — shop logo + cover image on the seller's Boutique Profile.
--
-- `boutiques.cover_url` already existed but was never written to by the app (the
-- seller Boutique Profile page was entirely mock/hardcoded). This adds the
-- missing `logo_url` and a storage bucket for both images.
--
-- The storage policies deliberately mirror 0017's proven shape (authenticated +
-- bucket check, no path-ownership sub-check) so branding uploads can't hit the
-- same "new row violates row-level security policy" wall product photos did.
--
-- Idempotent: re-runnable in the Supabase SQL editor.

-- ── Boutiques: shop logo ─────────────────────────────────────────────────────
alter table boutiques add column if not exists logo_url text;

-- ── Storage: boutique branding (logo + cover) ────────────────────────────────
insert into storage.buckets (id, name, public)
values ('boutique-images', 'boutique-images', true)
on conflict (id) do update set public = true;

drop policy if exists "boutique-images: public read"   on storage.objects;
drop policy if exists "boutique-images: authed upload" on storage.objects;
drop policy if exists "boutique-images: authed update" on storage.objects;
drop policy if exists "boutique-images: authed delete" on storage.objects;

-- Public read — buyers see the logo/cover on the boutique page anonymously.
create policy "boutique-images: public read" on storage.objects for select
  using (bucket_id = 'boutique-images');

create policy "boutique-images: authed upload" on storage.objects for insert
  to authenticated
  with check (bucket_id = 'boutique-images');

create policy "boutique-images: authed update" on storage.objects for update
  to authenticated
  using (bucket_id = 'boutique-images')
  with check (bucket_id = 'boutique-images');

create policy "boutique-images: authed delete" on storage.objects for delete
  to authenticated
  using (bucket_id = 'boutique-images');
