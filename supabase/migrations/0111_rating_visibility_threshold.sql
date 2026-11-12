-- ═══════════════════════════════════════════════════════════════════════════════
-- 0111 — Minimum reviews before a star rating is shown to a buyer
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- One number: how many reviews a product or a boutique needs before the
-- storefront is willing to print its rating.
--
-- WHAT IT FIXES
-- `products.rating` / `reviews_count` and `boutiques.rating` / `reviews_count`
-- are denormalised columns maintained by 0014's trigger, and both DEFAULT TO 0.
-- A boutique that opened this morning therefore carries a truthful
-- `rating = 0, reviews_count = 0` — which the cards were rendering literally,
-- as "★ 0" and "(0)". A shopper does not read that as "not yet reviewed"; they
-- read it as a shop that was rated, and rated zero. On a marketplace that is
-- still filling up that is being shown on every busy screen at once: the home
-- rails, Best sellers, the category pages, the boutique directory, the product
-- page and the feed.
--
-- WHY A THRESHOLD AND NOT A "HIDE ALL RATINGS" SWITCH
-- A single platform-wide toggle was the first idea and was rejected. It cannot
-- tell a new shop's 0 from an established shop's 4.8, so it hides the second in
-- order to protect the first — discarding the single most persuasive thing a
-- good seller has earned — and nothing ever prompts anyone to switch it back.
-- A minimum count is self-healing: each product and each shop crosses the line
-- on its own as real buyers review it.
--
-- It is also the rule the ranker already follows. `src/lib/ranking.ts`
-- discounts a rating through `bayesianRating()` until there are enough reviews
-- to trust it, so this makes the badge agree with the ordering.
--
-- A blanket blackout is still available when it is wanted — set this to 999 and
-- no rating is shown anywhere. Nothing is given up by preferring the threshold.
--
-- DEFAULT 1, DELIBERATELY
-- 1 reproduces the behaviour the application always intended: show a rating
-- once a real review exists. So applying this migration changes no stored
-- behaviour by itself — the visible change comes from the client finally
-- HONOURING the rule, which it was not doing. It also means a deployment that
-- has not run this migration yet is not broken, merely un-tunable.
--
-- WHO IGNORES IT
-- The seller and admin consoles. A seller must always see their own true
-- average, at one review or at a thousand; `seller/Dashboard.tsx`,
-- `seller/Reviews.tsx` and `admin/ReviewsAdmin.tsx` are untouched by this.
--
-- THIS RULE HAS THREE MIRRORS — see `src/lib/ratingDisplay.ts` for the full
-- note. Briefly: the badges, `src/lib/schema.ts`, and `middleware.js`. They
-- must agree, because structured data claiming a rating the page does not show
-- is a Google review-snippet manual action. `middleware.js` reads this very
-- column at the edge rather than carrying its own copy of the number.
--
-- Idempotent, like every migration in this series.

-- ── The column ───────────────────────────────────────────────────────────────
alter table platform_settings
  add column if not exists min_reviews_to_show int not null default 1;

-- A zero or a negative here would mean "show every rating including the 0s",
-- i.e. the bug this migration exists to prevent, and it would arrive silently
-- through a mistyped admin form. The floor of 1 makes that unrepresentable.
-- The ceiling is only a sanity bound; 999 is already far past "hide everything".
do $$
begin
  alter table platform_settings
    add constraint platform_settings_min_reviews_to_show_sane
    check (min_reviews_to_show between 1 and 9999);
exception
  when duplicate_object then null;  -- already applied
end $$;

comment on column platform_settings.min_reviews_to_show is
  'How many reviews a product or boutique needs before the storefront prints '
  'its star rating; below it the badge is omitted entirely. Mirrored by '
  'src/lib/ratingDisplay.ts, src/lib/schema.ts and middleware.js, which must '
  'agree or Google sees ratings the page does not show. 1 = show as soon as a '
  'review exists (the default). A large value hides every rating platform-wide.';

-- ── Read access ──────────────────────────────────────────────────────────────
--
-- `platform_settings` is world-readable by policy (0048: "settings: public read"
-- is `using (true)`) and its grants are table-level — 0073 revoked exactly one
-- column (`updated_by`), leaving a new column covered by the table grant.
--
-- The explicit grant is belt-and-braces, and follows 0096's reasoning: anon
-- MUST be able to read this, because `middleware.js` reads it at the edge with
-- the ANON key. If that read fails the edge falls back to 1 and keeps serving —
-- but then the edge and the client could disagree about the threshold, which is
-- the one failure mode that puts a rating in the rich result and not on the
-- page. Making the grant explicit means a future switch to column-by-column
-- grants cannot introduce that quietly.
grant select (min_reviews_to_show) on platform_settings to anon, authenticated;

-- ── Verify ───────────────────────────────────────────────────────────────────
--
--   -- 1. the column exists and defaults to 1:
--   select min_reviews_to_show from platform_settings where id = 1;
--
--   -- 2. anon can read it (this is exactly what middleware.js does):
--   select column_name from information_schema.column_privileges
--    where table_name = 'platform_settings' and grantee = 'anon'
--      and column_name = 'min_reviews_to_show';
--
--   -- 3. the floor holds — this must RAISE, not store a 0:
--   update platform_settings set min_reviews_to_show = 0 where id = 1;
--
--   -- 4. blackout and back. After (a), no star should appear anywhere on the
--   --    storefront, AND no aggregateRating in the page source:
--   --      curl -s https://<host>/p/<slug> | grep -o 'aggregateRating'
--   update platform_settings set min_reviews_to_show = 999 where id = 1;  -- (a)
--   update platform_settings set min_reviews_to_show = 1   where id = 1;  -- (b)
--
--   -- NOTE: the edge caches this for a minute (RATING_TTL_MS in middleware.js),
--   -- so give (a) and (b) ~60s before judging the crawler-visible output.
