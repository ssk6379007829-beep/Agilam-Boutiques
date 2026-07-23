-- Inspire feed music — the 15-second song a boutique can pin to a piece.
--
-- Instagram-style: when listing a product the seller searches online music and
-- picks a track, and its clip plays on that product's Inspire card (tap to turn
-- sound on, one clip audible at a time). The feed stays catalogue-driven — this
-- is two more columns on the product, not a second content system, and there is
-- no upload: `music_url` is the picked track's public preview URL.
--
--   products.music_url   — preview-clip URL of the chosen track (null = no song).
--   products.music_title — what shows in the card's music pill, e.g.
--                          "Track name · Artist", the credit the buyer sees.
--
-- Idempotent: re-runnable in the Supabase SQL editor. Run after 0031.

alter table products add column if not exists music_url   text;
alter table products add column if not exists music_title text;
