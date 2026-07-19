-- Shareable boutique handle — a clean, unique slug for premium profile links.
--
-- The buyer profile can be shared as `<site>/b/<slug>` (e.g. /b/elegance-boutique)
-- so a boutique can drop the link in an Instagram bio or WhatsApp status. The
-- slug is derived from the name, kept unique, and never changes once set.
--
-- Run this once in the Supabase SQL editor after the earlier migrations. Safe
-- to re-run.

alter table boutiques add column if not exists slug text;

-- Backfill a slug for existing rows: lowercase, non-alphanumerics -> single '-'.
-- Collisions get a short suffix from the id so the unique index below holds.
update boutiques b set slug = base.slug
from (
  select id,
    case
      when count(*) over (partition by s) = 1 then s
      else s || '-' || substr(id::text, 1, 4)
    end as slug
  from (
    select id,
      trim(both '-' from regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')) as s
    from boutiques
  ) x
) base
where b.id = base.id and b.slug is null;

create unique index if not exists boutiques_slug_key on boutiques (slug);
