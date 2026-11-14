# MangaiMart SEO — 10x Audit & Enhancement Pass

**Date:** 2026-11-14
**Scope constraint (owner):** SEO only — no changes to the rendered pages, app
behaviour, routes, Merchant/Shopping schema, or Tamil/hreflang. Enhance the
existing crawler-facing layer only.
**Layer touched:** `middleware.js` (edge SEO), `scripts/verify-seo.mjs`. No React,
no SQL, no UI.

---

## 1. Verdict

The SEO layer was already operating at roughly 9–9.5 out of 10 before this pass.
Almost every "advanced e-commerce SEO" item from a standard playbook (the Zoho
checklist the owner shared, plus modern rich-results and AI-search practice) was
**already implemented** server-side in `middleware.js` and mirrored in
`src/lib/schema.ts`. There was no basic work left to do.

This pass added the three genuinely-missing, constraint-safe items and documented
the rest as deliberate opt-ins.

---

## 2. What was already in place (verified by reading the code)

**On-page**
- Per-page server-rendered `<title>`, meta description, canonical, author.
- Brand-first titles with truncation guard (`titleWithBrand`).
- `<noscript>` crawlable body ("prerender") on product, boutique, hub, and facet
  pages — real HTML for Bing, GPTBot, ClaudeBot, PerplexityBot, WhatsApp, etc.
- Internal linking from the home/`/shop`/`/collections` prerenders into the
  catalogue and facet landings (kills orphan pages).

**Technical**
- Canonical-host 301 (apex), `www` and `*.vercel.app` previews walled off.
- `robots` directive with `max-image-preview:large, max-snippet:-1,
  max-video-preview:-1`.
- `noindex` + `X-Robots-Tag` on every private/checkout/console path; soft-404
  guard so `/products/<anything>` can't become an indexable farm.
- Sitemap **index of three** (pages / boutiques / products), real per-row
  `lastmod` (a shop's date = its newest piece), `image:image` entries,
  `changefreq`, `priority`.
- LCP `<link rel=preload>` matched byte-for-byte to the `<img>` srcset, Supabase
  `preconnect` (both credentials modes).
- `robots.txt` explicitly admits AI search bots (GPTBot, OAI-SearchBot,
  PerplexityBot, ClaudeBot, Google-Extended) and blocks resale scrapers
  (AhrefsBot, SemrushBot).

**Structured data (JSON-LD `@graph`)**
- `Organization`/`OnlineStore` with `alternateName`, `sameAs`, `contactPoint`,
  `logo` as sized `ImageObject`, `knowsLanguage [en, ta]`.
- `WebSite` + `SearchAction` (sitelinks search box).
- `Product` + `Offer` (+ `priceValidUntil`), `AggregateRating` and `Review`
  **gated** to only appear when the storefront actually shows the rating
  (migration 0111 threshold, mirrored in three places).
- `ClothingStore` (LocalBusiness) with `OpeningHoursSpecification`, address,
  `sameAs`.
- `BreadcrumbList` on product and facet pages.
- `CollectionPage` + `ItemList` on category/occasion/fabric/colour/budget and
  city landings.
- `FAQPage` on `/help` (mirrored from visible copy).

**Local**
- City landing pages `/boutiques/<city>`, `ClothingStore` + `PostalAddress`,
  opening hours, per-city sitemap entries.

**Shopping**
- `/merchant-feed.xml` (RSS 2.0 `g:` namespace) for Google Merchant Center.

---

## 3. What this pass added (applied + verified)

| # | Change | Why it was in-bounds | Verified |
|---|--------|----------------------|----------|
| 1 | **`/llms.txt`** served from the edge (curated markdown summary + key links; preview deploys get a canonical-pointing stub) | Pure AI/LLM discovery file; changes no page. Facts kept accurate to CLAUDE.md (prepaid-only, seller-set delivery, 7-day + 30-day returns, commission+ads). | `verify:seo` → `llms.txt ok (44 lines)`, `preview llms.txt ok`; added to `config.matcher`. |
| 2 | **`WebPage` schema node** on all ~20 static written pages (policies, sell, about, help) | Additive; mirrors existing `articleSchema()`; asserts nothing about visible layout, so no "markup must match page" risk. Makes each page an addressable entity, not just "a page by a known publisher". | `verify:seo` → every `static meta` row now shows `…,WebSite,WebPage`. |
| 3 | **New verifier assertions** — `llms.txt` contents + matcher, preview stub, `WebPage` presence | Keeps the additions from silently regressing (the edge fails silently by design). | Runs green for the non-DB checks. |

**Regression check:** baseline `main` fails 23 DB-backed checks on this machine
(the catalogue tables aren't reachable here — `sitemap urls: 22` = static pages
only). With these edits the count is **still exactly 23** — zero new failures —
and all non-DB checks, including the three new ones, pass. The 23 are
environmental and pass in production.

---

## 4. Deliberately NOT done (owner's constraints) — opt-in later

- **Programmatic city × category landing pages** ("Silk sarees in Coimbatore").
  Biggest remaining traffic lever for a marketplace, but needs **new indexable
  routes** — excluded by "enhance existing only / don't change the site". Revisit
  if you want net-new pages; the facet + city landing machinery already here is
  the foundation.
- **Merchant return/shipping structured data on the edge `Product` Offer.**
  Declined via the Merchant-Center question. **Note a real parity gap found:**
  `src/lib/schema.ts` (client) *does* emit `hasMerchantReturnPolicy` +
  `shippingDetails` on the Product Offer; `middleware.js` (what crawlers read)
  does **not**. So the richer offer only exists on Google's slower rendered pass.
  Harmless today, but worth closing when you next want Shopping/free-listing
  richness — say the word and it's a small, safe edit.
- **hreflang `en`/`ta`.** "Plan for later" — no Tamil pages exist yet, and wrong
  hreflang hurts more than none. `knowsLanguage`/`availableLanguage` already
  carry Tamil as a signal.
- **Extra explicit AI-bot allows** (Applebot-Extended, Amazonbot, CCBot). Already
  permitted by the `User-agent: *  Allow: /` wildcard, so naming them is cosmetic.

---

## 5. Validate in production (owner actions)

1. After the next deploy, fetch `https://mangaimart.com/llms.txt` — should be
   200, `text/plain`, with the summary and section links.
2. Google **Rich Results Test** on a product URL and a policy URL — confirm
   `Product`/`Offer` (product) and `WebPage` (policy) parse clean.
3. **Search Console** → Sitemaps: the three children should each show rising
   "discovered / indexed" counts. The per-section split is deliberate so you can
   tell catalogue vs directory indexing apart.
4. Re-run `npm run verify:seo` from an environment that *can* reach Supabase
   (or trust the production edge) — all 23 DB checks should then pass too.

---

*Pass performed by the assistant on branch `Selvakumar`. No migrations, no UI,
no route changes. `npm run build` and `npm run verify:seo` both run; the only
verifier failures are the catalogue-DB checks that are unreachable from the dev
machine and fail identically on unmodified `main`.*
