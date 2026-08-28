-- The rest of the catalogue vocabulary — categories, occasions, fabrics, sizes.
--
-- Migration 0040 did this for colours and stopped there. The other four lists
-- are still carrying nothing but 0024's placeholder seed:
--
--   · FIVE categories (Sarees, Lehengas, Gowns, Kurtis, Bridal) for a shop that
--     stitches blouses, anarkalis, salwar suits, dress materials and half
--     sarees. A seller with a churidar set has no honest category to file it
--     under, so it lands in whatever is closest and the buyer's collection
--     tiles and /collections/<slug> pages never learn the word exists.
--   · SIX occasions, missing the ones this market actually shops for — haldi,
--     mehendi, sangeet, temple, Pongal.
--   · TWELVE fabrics, missing Banarasi, Mysore silk, Chanderi, Khadi, Muslin,
--     satin, brocade and most of the everyday bolt.
--   · FIVE sizes: S, M, L, XL, Free Size. That one now costs money rather than
--     discovery — per-size stock (0103) can only count sizes that exist here,
--     so a shop cutting 2XL has nowhere to put it, and a blouse has no numeric
--     size at all.
--
-- Categories and occasions carry a request queue, so in principle sellers ask
-- and an admin approves. In practice the list has to be roughly right on day
-- one: a seller who cannot find "Anarkali" files it under "Kurtis" and moves
-- on. Nobody requests what they have already worked around.
--
-- Scope is women's Indian ethnic wear — what this marketplace is. No men's,
-- kids' or accessories: the size ladder, parcel weights and returns cover are
-- all written for a woman's garment, and a category is cheap to add later.
--
-- Craft names sellers often type into the fabric box — Kalamkari, Bandhani,
-- Ikat, Chikankari — are deliberately NOT seeded as fabrics. They describe the
-- work, not the cloth, and filing them under fabric makes "Chikankari" and
-- "Cotton" mutually exclusive when a piece is both. They need a `kind` of
-- their own, which is a schema change and a separate decision.
--
-- No `icon` or tile art is set on anything new. Both are presentation the admin
-- curates per term on the Catalogue page, and the existing five categories keep
-- the glyphs 0024 gave them — the upsert below never touches that column.
--
-- Idempotent, and it never overrides an admin: a term they have REJECTED is
-- left rejected, and re-running only re-slots sort order. Apply any time after
-- 0024; independent of 0103.

-- The decision guard (0024) raises when anything other than an admin changes a
-- term's status, and in the SQL editor `is_admin()` is false. Any term below
-- that a seller has already REQUESTED is sitting at 'pending', and approving it
-- here is the whole point — so the trigger comes off for the seed exactly as
-- migration 0073 does for its data fix, and goes straight back on.
alter table taxonomy disable trigger taxonomy_guard_decision;

insert into taxonomy (kind, name, name_key, status, sort_order)
values
  -- ── Categories ─────────────────────────────────────────────────────────────
  -- Draped first, then stitched sets, then the pieces sold on their own.
  ('category', 'Sarees',          'sarees',          'approved',  10),
  ('category', 'Blouses',         'blouses',         'approved',  20),
  ('category', 'Half Sarees',     'half sarees',     'approved',  30),
  ('category', 'Lehengas',        'lehengas',        'approved',  40),
  ('category', 'Salwar Suits',    'salwar suits',    'approved',  50),
  ('category', 'Churidar Sets',   'churidar sets',   'approved',  60),
  ('category', 'Anarkali Suits',  'anarkali suits',  'approved',  70),
  ('category', 'Kurtis',          'kurtis',          'approved',  80),
  ('category', 'Kurta Sets',      'kurta sets',      'approved',  90),
  ('category', 'Co-ord Sets',     'co-ord sets',     'approved', 100),
  ('category', 'Palazzo Sets',    'palazzo sets',    'approved', 110),
  ('category', 'Sharara Sets',    'sharara sets',    'approved', 120),
  ('category', 'Gharara Sets',    'gharara sets',    'approved', 130),
  ('category', 'Gowns',           'gowns',           'approved', 140),
  ('category', 'Indo-Western',    'indo-western',    'approved', 150),
  ('category', 'Dress Materials', 'dress materials', 'approved', 160),
  ('category', 'Dupattas',        'dupattas',        'approved', 170),
  ('category', 'Ethnic Skirts',   'ethnic skirts',   'approved', 180),
  ('category', 'Bridal',          'bridal',          'approved', 190),
  ('category', 'Maternity Wear',  'maternity wear',  'approved', 200),
  ('category', 'Nightwear',       'nightwear',       'approved', 210),

  -- ── Occasions ──────────────────────────────────────────────────────────────
  -- Wedding season first, since that is what the shops are stocked for, then
  -- festivals, then everyday.
  ('occasion', 'Bridal',       'bridal',       'approved',  10),
  ('occasion', 'Wedding',      'wedding',      'approved',  20),
  ('occasion', 'Engagement',   'engagement',   'approved',  30),
  ('occasion', 'Reception',    'reception',    'approved',  40),
  ('occasion', 'Haldi',        'haldi',        'approved',  50),
  ('occasion', 'Mehendi',      'mehendi',      'approved',  60),
  ('occasion', 'Sangeet',      'sangeet',      'approved',  70),
  ('occasion', 'Festive',      'festive',      'approved',  80),
  ('occasion', 'Diwali',       'diwali',       'approved',  90),
  ('occasion', 'Pongal',       'pongal',       'approved', 100),
  ('occasion', 'Navratri',     'navratri',     'approved', 110),
  ('occasion', 'Temple Visit', 'temple visit', 'approved', 120),
  ('occasion', 'Party',        'party',        'approved', 130),
  ('occasion', 'Birthday',     'birthday',     'approved', 140),
  ('occasion', 'Anniversary',  'anniversary',  'approved', 150),
  ('occasion', 'Baby Shower',  'baby shower',  'approved', 160),
  ('occasion', 'Housewarming', 'housewarming', 'approved', 170),
  ('occasion', 'Office Wear',  'office wear',  'approved', 180),
  ('occasion', 'College Wear', 'college wear', 'approved', 190),
  ('occasion', 'Casual',       'casual',       'approved', 200),

  -- ── Fabrics ────────────────────────────────────────────────────────────────
  -- Silks, then the handloom and cotton family, then sheers, then the
  -- man-mades. Roughly descending by what a boutique charges for it, which is
  -- also the order a seller thinks in.
  ('fabric', 'Kanchipuram Silk', 'kanchipuram silk', 'approved',  10),
  ('fabric', 'Banarasi Silk',    'banarasi silk',    'approved',  20),
  ('fabric', 'Mysore Silk',      'mysore silk',      'approved',  30),
  ('fabric', 'Tussar Silk',      'tussar silk',      'approved',  40),
  ('fabric', 'Raw Silk',         'raw silk',         'approved',  50),
  ('fabric', 'Soft Silk',        'soft silk',        'approved',  60),
  ('fabric', 'Silk',             'silk',             'approved',  70),
  ('fabric', 'Art Silk',         'art silk',         'approved',  80),
  ('fabric', 'Cotton Silk',      'cotton silk',      'approved',  90),
  ('fabric', 'Chanderi',         'chanderi',         'approved', 100),
  ('fabric', 'Maheshwari',       'maheshwari',       'approved', 110),
  ('fabric', 'Khadi',            'khadi',            'approved', 120),
  ('fabric', 'Cotton',           'cotton',           'approved', 130),
  ('fabric', 'Muslin',           'muslin',           'approved', 140),
  ('fabric', 'Linen',            'linen',            'approved', 150),
  ('fabric', 'Georgette',        'georgette',        'approved', 160),
  ('fabric', 'Chiffon',          'chiffon',          'approved', 170),
  ('fabric', 'Organza',          'organza',          'approved', 180),
  ('fabric', 'Net',              'net',              'approved', 190),
  ('fabric', 'Tissue',           'tissue',           'approved', 200),
  ('fabric', 'Velvet',           'velvet',           'approved', 210),
  ('fabric', 'Satin',            'satin',            'approved', 220),
  ('fabric', 'Brocade',          'brocade',          'approved', 230),
  ('fabric', 'Jacquard',         'jacquard',         'approved', 240),
  ('fabric', 'Crepe',            'crepe',            'approved', 250),
  ('fabric', 'Rayon',            'rayon',            'approved', 260),
  ('fabric', 'Modal',            'modal',            'approved', 270),
  ('fabric', 'Viscose',          'viscose',          'approved', 280),
  ('fabric', 'Polyester',        'polyester',        'approved', 290),
  ('fabric', 'Lycra',            'lycra',            'approved', 300),
  ('fabric', 'Denim',            'denim',            'approved', 310),

  -- ── Sizes ──────────────────────────────────────────────────────────────────
  -- ONE convention for the plus sizes, on purpose. src/lib/sizes.ts ranks
  -- '2XL' and 'XXL' identically, so seeding both would put two chips for the
  -- same size next to each other in the seller's picker, in arbitrary order,
  -- each holding its own stock. 2XL wins because that is what the size charts
  -- this catalogue is modelled on print.
  --
  -- The numeric run is blouse and dress-material sizing; 'Unstitched' is what a
  -- dress material or blouse piece actually ships as. This order matches
  -- sizeRank() exactly, so the taxonomy and the app never disagree about the
  -- ladder: letters, then numbers, then Unstitched, then Free Size.
  ('size', 'XS',         'xs',         'approved',  10),
  ('size', 'S',          's',          'approved',  20),
  ('size', 'M',          'm',          'approved',  30),
  ('size', 'L',          'l',          'approved',  40),
  ('size', 'XL',         'xl',         'approved',  50),
  ('size', '2XL',        '2xl',        'approved',  60),
  ('size', '3XL',        '3xl',        'approved',  70),
  ('size', '4XL',        '4xl',        'approved',  80),
  ('size', '5XL',        '5xl',        'approved',  90),
  ('size', '32',         '32',         'approved', 100),
  ('size', '34',         '34',         'approved', 110),
  ('size', '36',         '36',         'approved', 120),
  ('size', '38',         '38',         'approved', 130),
  ('size', '40',         '40',         'approved', 140),
  ('size', '42',         '42',         'approved', 150),
  ('size', '44',         '44',         'approved', 160),
  ('size', 'Unstitched', 'unstitched', 'approved', 170),
  ('size', 'Free Size',  'free size',  'approved', 180)
on conflict (kind, name_key) do update
  set sort_order = excluded.sort_order,
      status = 'approved'
  -- A term an admin has turned down stays turned down, and keeps the sort order
  -- they left it at. Re-running this must never quietly undo a decision.
  where taxonomy.status <> 'rejected';

alter table taxonomy enable trigger taxonomy_guard_decision;
