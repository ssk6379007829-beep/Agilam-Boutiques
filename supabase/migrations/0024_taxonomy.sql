-- Managed catalogue vocabulary — categories, occasions, fabrics, colours, sizes.
--
-- Until now every one of these was a free-text box on the seller's product
-- form, and the buyer app filtered against a hardcoded list in the design file.
-- Both halves of that were wrong in the same way:
--
--   · Sellers typed "saree", "Saree", "Silk Saree" and "SAREES" into the same
--     field. Four categories, four filter chips, one garment. Nothing groups.
--   · Anything a seller typed that was not one of the five names in
--     `FILTER_CATS` was unreachable — the piece existed but no filter, no
--     collection tile and no Home circle could ever surface it.
--
-- So the vocabulary becomes data: one small table the admin owns, the seller
-- picks from, and the buyer app browses by. A seller who genuinely needs a name
-- that is not there requests it; it reaches buyers as a browsable facet only
-- once an admin approves it. Their product is never held hostage to that
-- decision — it goes live immediately under the requested name and is findable
-- by search; only the browse facet waits.
--
-- Idempotent: re-runnable in the Supabase SQL editor.

create table if not exists taxonomy (
  id uuid primary key default gen_random_uuid(),

  -- Which vocabulary this term belongs to. Colours and sizes are seeded and
  -- admin-managed only: a colour needs a swatch hex to render on the filter,
  -- and sizes are a fixed ladder, so neither is worth a request queue.
  kind text not null check (kind in ('category', 'occasion', 'fabric', 'color', 'size')),

  name text not null,
  -- Case- and space-insensitive identity, so "Silk Saree" and "silk  saree"
  -- cannot both exist. Maintained by trigger rather than left to the caller.
  name_key text not null,

  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),

  -- Presentation, all optional and all admin-set: the swatch for a colour, a
  -- Material Symbols glyph and tile art for a category or occasion.
  hex text,
  icon text,
  image_url text,
  sort_order integer not null default 0,

  -- Who asked, and why. `boutique_id` is what lets an admin see that the same
  -- shop has asked for six near-identical names.
  requested_by uuid references profiles(id) on delete set null,
  boutique_id uuid references boutiques(id) on delete set null,
  note text,

  -- The admin's decision. A rejection with no reason leaves the seller nothing
  -- to act on, so the app requires this on reject.
  review_note text,
  reviewed_at timestamptz,
  reviewed_by uuid references profiles(id) on delete set null,

  created_at timestamptz not null default now()
);

create unique index if not exists idx_taxonomy_kind_name on taxonomy (kind, name_key);
create index if not exists idx_taxonomy_status on taxonomy (kind, status);

-- ── name_key is derived, never supplied ─────────────────────────────────────
create or replace function taxonomy_set_name_key()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.name := btrim(new.name);
  if new.name = '' then
    raise exception 'taxonomy: name cannot be empty';
  end if;
  -- Collapse internal runs of whitespace as well, so "Art  Silk" = "Art Silk".
  new.name_key := lower(regexp_replace(new.name, '\s+', ' ', 'g'));
  return new;
end $$;

drop trigger if exists taxonomy_set_name_key on taxonomy;
create trigger taxonomy_set_name_key
  before insert or update of name on taxonomy
  for each row execute function taxonomy_set_name_key();

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table taxonomy enable row level security;

do $$ begin
  -- Approved terms are public: the buyer app builds its filters from them and
  -- anonymous browsing is the norm here.
  create policy "taxonomy: public read approved" on taxonomy
    for select using (status = 'approved');
exception when duplicate_object then null; end $$;

do $$ begin
  -- A seller can see the state of what they asked for — pending and rejected
  -- included — because the product form has to be able to say "still with our
  -- team" or "turned down, here's why".
  create policy "taxonomy: requester reads own" on taxonomy
    for select using (requested_by = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "taxonomy: admin reads all" on taxonomy
    for select using (is_admin());
exception when duplicate_object then null; end $$;

do $$ begin
  -- Sellers may only ever file a *request*: pending, attributed to themselves,
  -- in one of the three open-ended vocabularies. WITH CHECK is what stops the
  -- obvious attack — inserting a row that is already `approved`.
  create policy "taxonomy: seller requests" on taxonomy
    for insert to authenticated
    with check (
      status = 'pending'
      and requested_by = auth.uid()
      and kind in ('category', 'occasion', 'fabric')
      and hex is null and icon is null and image_url is null
      and review_note is null and reviewed_at is null and reviewed_by is null
      -- Presentation is the admin's, including position: without this a
      -- request could arrive pre-sorted to the front of the buyer's filter row.
      and sort_order = 0
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "taxonomy: admin writes" on taxonomy
    for all using (is_admin()) with check (is_admin());
exception when duplicate_object then null; end $$;

-- Belt and braces behind the INSERT policy: an UPDATE by a non-admin is already
-- impossible (no policy grants it), but if one is ever added, the decision
-- fields stay the admin's.
create or replace function taxonomy_guard_decision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if is_admin() then
    return new;
  end if;
  if new.status is distinct from old.status
  or new.review_note is distinct from old.review_note
  or new.reviewed_at is distinct from old.reviewed_at
  or new.reviewed_by is distinct from old.reviewed_by then
    raise exception 'taxonomy: approval is admin-managed';
  end if;
  return new;
end $$;

drop trigger if exists taxonomy_guard_decision on taxonomy;
create trigger taxonomy_guard_decision
  before update on taxonomy
  for each row execute function taxonomy_guard_decision();

-- ── Seed ────────────────────────────────────────────────────────────────────
-- Two sources, in this order:
--
--   1. The design's vocabulary — the names the buyer app already filters by,
--      with their swatches and glyphs.
--   2. Whatever sellers have already typed into the free-text fields. These are
--      seeded as approved rather than pending, because they are already live on
--      the buyer side; demoting them to pending on migration day would empty
--      the filters and orphan real listings. Tidying near-duplicates is then a
--      deliberate admin action on the Catalogue page, not a side effect.
insert into taxonomy (kind, name, name_key, status, icon, hex, sort_order)
values
  ('category', 'Sarees',   'sarees',   'approved', 'checkroom',  null, 10),
  ('category', 'Lehengas', 'lehengas', 'approved', 'apparel',    null, 20),
  ('category', 'Gowns',    'gowns',    'approved', 'woman',      null, 30),
  ('category', 'Kurtis',   'kurtis',   'approved', 'styler',     null, 40),
  ('category', 'Bridal',   'bridal',   'approved', 'diamond',    null, 50),

  ('occasion', 'Bridal',    'bridal',    'approved', 'diamond',     null, 10),
  ('occasion', 'Wedding',   'wedding',   'approved', 'favorite',    null, 20),
  ('occasion', 'Reception', 'reception', 'approved', 'nightlife',   null, 30),
  ('occasion', 'Festive',   'festive',   'approved', 'celebration', null, 40),
  ('occasion', 'Party',     'party',     'approved', 'local_bar',   null, 50),
  ('occasion', 'Casual',    'casual',    'approved', 'wb_sunny',    null, 60),

  ('color', 'Pink',   'pink',   'approved', null, '#E7719F', 10),
  ('color', 'Red',    'red',    'approved', null, '#D6455A', 20),
  ('color', 'Green',  'green',  'approved', null, '#5FA37E', 30),
  ('color', 'Purple', 'purple', 'approved', null, '#9B7FC7', 40),
  ('color', 'Yellow', 'yellow', 'approved', null, '#E0B84B', 50),
  ('color', 'Teal',   'teal',   'approved', null, '#4F9CA3', 60),
  ('color', 'Peach',  'peach',  'approved', null, '#E8A583', 70),

  ('size', 'S',         's',         'approved', null, null, 10),
  ('size', 'M',         'm',         'approved', null, null, 20),
  ('size', 'L',         'l',         'approved', null, null, 30),
  ('size', 'XL',        'xl',        'approved', null, null, 40),
  ('size', 'Free Size', 'free size', 'approved', null, null, 50),

  -- A starting fabric list. Sellers will request the rest; that is the point.
  ('fabric', 'Kanchipuram Silk', 'kanchipuram silk', 'approved', null, null, 10),
  ('fabric', 'Silk',             'silk',             'approved', null, null, 20),
  ('fabric', 'Art Silk',         'art silk',         'approved', null, null, 30),
  ('fabric', 'Cotton',           'cotton',           'approved', null, null, 40),
  ('fabric', 'Georgette',        'georgette',        'approved', null, null, 50),
  ('fabric', 'Organza',          'organza',          'approved', null, null, 60),
  ('fabric', 'Chiffon',          'chiffon',          'approved', null, null, 70),
  ('fabric', 'Velvet',           'velvet',           'approved', null, null, 80),
  ('fabric', 'Net',              'net',              'approved', null, null, 90),
  ('fabric', 'Linen',            'linen',            'approved', null, null, 100),
  ('fabric', 'Rayon',            'rayon',            'approved', null, null, 110),
  ('fabric', 'Crepe',            'crepe',            'approved', null, null, 120)
on conflict (kind, name_key) do nothing;

-- Adopt whatever is already in the catalogue. DISTINCT ON the normalised key,
-- not on the raw text: if two sellers typed "Art Silk" and "art  silk", they
-- are one term here and the first spelling wins.
insert into taxonomy (kind, name, name_key, status, sort_order)
select distinct on (kind, name_key) kind, name, name_key, 'approved', 900
  from (
    select k.kind,
           btrim(v.name) as name,
           lower(regexp_replace(btrim(v.name), '\s+', ' ', 'g')) as name_key
      from (values ('category'), ('occasion'), ('fabric'), ('color')) as k(kind)
     cross join lateral (
       select case k.kind
                when 'category' then p.category
                when 'occasion' then p.occasion
                when 'fabric'   then p.fabric
                else p.color
              end as name
         from products p
        where p.deleted_at is null
     ) v
     where btrim(coalesce(v.name, '')) <> ''
  ) s
on conflict (kind, name_key) do nothing;

-- ── Storage: collection tile art ────────────────────────────────────────────
-- A category the admin approves needs a picture, and the design's six hand-drawn
-- circles cannot supply one for a name it never anticipated. Until there is an
-- upload the tile falls back to a photo of something listed under it, which is
-- a decent stand-in but not a chosen image — so the admin can put a real one here.
--
-- Unlike the product and branding buckets, writing here is admins only: this art
-- appears on the Home rail and the Collections page, i.e. it is Agilam's own
-- shop window rather than any one seller's.
insert into storage.buckets (id, name, public)
values ('catalogue-images', 'catalogue-images', true)
on conflict (id) do update set public = true;

drop policy if exists "catalogue-images: public read"  on storage.objects;
drop policy if exists "catalogue-images: admin upload" on storage.objects;
drop policy if exists "catalogue-images: admin update" on storage.objects;
drop policy if exists "catalogue-images: admin delete" on storage.objects;

create policy "catalogue-images: public read" on storage.objects for select
  using (bucket_id = 'catalogue-images');

create policy "catalogue-images: admin upload" on storage.objects for insert
  to authenticated
  with check (bucket_id = 'catalogue-images' and is_admin());

create policy "catalogue-images: admin update" on storage.objects for update
  to authenticated
  using (bucket_id = 'catalogue-images' and is_admin())
  with check (bucket_id = 'catalogue-images' and is_admin());

create policy "catalogue-images: admin delete" on storage.objects for delete
  to authenticated
  using (bucket_id = 'catalogue-images' and is_admin());

-- ── Grants ──────────────────────────────────────────────────────────────────
grant select on taxonomy to anon, authenticated;
grant insert on taxonomy to authenticated;
grant update, delete on taxonomy to authenticated; -- gated by the admin policy above
