import { useCallback, useSyncExternalStore } from 'react';
import { currentSettings, subscribeSettings } from '@/data/settings';

/**
 * When a star rating is allowed to be shown to a buyer.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 *
 * `products.rating` / `boutiques.rating` and their `reviews_count` siblings are
 * denormalised columns maintained by the trigger in migration 0014, and both
 * DEFAULT TO 0. So a boutique that opened this morning — and every product in
 * it — carries a perfectly truthful `rating = 0, reviews_count = 0`.
 *
 * Rendered literally, that came out as "★ 0" and "(0)" on the cards. No shopper
 * reads that as "nobody has reviewed this yet". They read it as a shop that has
 * been rated, and rated zero. On a marketplace that is still filling up, that
 * is the worst possible first impression and it was being shown on the busiest
 * screens: the home rails, Best sellers, the category pages, the boutique
 * directory, the product page and the feed.
 *
 * The review SECTIONS were never the problem — `BoutiqueReviews` and
 * `ProductReviews` already say "No reviews yet" in words, which is honest and
 * reads fine. It was only ever the numeric badge.
 *
 * ── Why a threshold rather than an on/off switch ────────────────────────────
 *
 * The obvious fix is a platform-wide "hide all ratings" toggle in the admin
 * console. It was considered and rejected: one switch cannot tell a new shop's
 * zero from an established shop's 4.8, so it hides the second to protect the
 * first — throwing away the strongest thing a good seller has earned. And
 * nothing ever reminds anyone to turn it back on.
 *
 * A minimum review count is self-healing instead. Each product and each shop
 * crosses the line on its own as real buyers review it; no one flips anything.
 * It is also the rule `src/lib/ranking.ts` already believes in —
 * `bayesianRating()` discounts a rating until there are enough reviews to trust
 * it — so the badge and the ranker finally agree about what "rated" means.
 *
 * Setting the threshold absurdly high (999) gives you the blanket off-switch
 * anyway, so nothing is given up by preferring the threshold.
 *
 * ── The number is a platform setting ────────────────────────────────────────
 *
 * `platform_settings.min_reviews_to_show`, migration 0111, admin-editable.
 * It is NOT a constant, because `middleware.js` has to apply the identical rule
 * at the edge (see below) and a constant would have to be duplicated there by
 * hand — which is exactly how `src/lib/pricing.ts` and `api/_pricing.js` drift.
 *
 * ── This rule has THREE mirrors, and they must agree ────────────────────────
 *
 *   1. this file          — every buyer-facing badge
 *   2. `src/lib/schema.ts` — the client-rendered JSON-LD
 *   3. `middleware.js`     — the edge-rendered JSON-LD, which is the one
 *                            crawlers actually read
 *
 * They must agree because Google treats structured data that claims a rating
 * the page does not show as a review-snippet manual action. Before this
 * existed all three gated on `reviews_count > 0`, which matched; raise the
 * threshold in one place only and a product with a single review renders no
 * stars while still advertising them in the rich result. `middleware.js` reads
 * the same `platform_settings` row for this reason — see `minReviewsToShow()`
 * there.
 *
 * ── Deliberately NOT applied to the seller or admin consoles ────────────────
 *
 * A seller must always see their true average, even at one review — it is their
 * own data and hiding it from them would be absurd. `seller/Dashboard.tsx`,
 * `seller/Reviews.tsx` and `admin/ReviewsAdmin.tsx` already guard the 0 case
 * properly on their own and are left alone.
 */

/**
 * The threshold when the database has not answered yet, or has no such column.
 *
 * 1 reproduces the behaviour the code always INTENDED — show a rating once a
 * real review exists — so a deployment without migration 0111 is not broken,
 * it simply has no knob. Failing to this rather than to a higher number also
 * means a database blip can never blank the ratings of shops that earned them.
 */
export const DEFAULT_MIN_REVIEWS_TO_SHOW = 1;

/**
 * Pure form of the rule. `reviews` is the count, `rating` the average.
 *
 * The `rating > 0` half is not redundant with the count: migration 0014's
 * trigger writes `coalesce(avg(...), 0)`, and a row that somehow carries a
 * count without an average would otherwise render "★ 0" again — the exact bug
 * this file exists to stop.
 */
export function ratingIsPublic(
  rating: number | null | undefined,
  reviews: number | null | undefined,
  minReviews: number,
): boolean {
  const min = Math.max(1, Math.floor(minReviews) || DEFAULT_MIN_REVIEWS_TO_SHOW);
  return (reviews ?? 0) >= min && (rating ?? 0) > 0;
}

/** The threshold in force right now. Never throws, never null. */
export function minReviewsToShow(): number {
  const n = currentSettings().min_reviews_to_show;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_MIN_REVIEWS_TO_SHOW;
}

/**
 * Synchronous predicate, for code that is not a component — `src/lib/schema.ts`
 * builds its JSON-LD during render and cannot hold a hook.
 *
 * Safe to call before the settings fetch lands: `currentSettings()` is seeded
 * from localStorage and falls back to the compile-time defaults, so the worst
 * case is one render against a threshold that is one page-load stale.
 */
export function showsRating(
  rating: number | null | undefined,
  reviews: number | null | undefined,
): boolean {
  return ratingIsPublic(rating, reviews, minReviewsToShow());
}

/**
 * Component form. Identical answer to `showsRating`, but re-renders the caller
 * when an admin changes the threshold, so the badges appear or vanish without
 * a reload.
 */
export function useShowsRating(): (
  rating: number | null | undefined,
  reviews: number | null | undefined,
) => boolean {
  const min = useSyncExternalStore(subscribeSettings, minReviewsToShow, minReviewsToShow);
  // Memoised on the threshold, not rebuilt per render: callers put this in
  // `useMemo` dependency arrays (the boutique directory counts rated shops with
  // it), and a fresh closure each render would recompute those every time.
  return useCallback(
    (rating, reviews) => ratingIsPublic(rating, reviews, min),
    [min],
  );
}
