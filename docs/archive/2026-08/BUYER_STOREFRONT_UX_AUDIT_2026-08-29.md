# Buyer Storefront — UI/UX Audit

**Date:** 2026-08-29
**Scope:** all 31 pages in `src/pages/buyer/` + 30 components in `src/components/buyer/`
(14,593 lines), plus the shared shell and primitives they depend on
**Lenses:** accessibility, forms & feedback, flow & navigation, visual consistency,
perceived speed & CLS, trust & conversion clarity, SEO & crawlability
**Breakpoints:** mobile and desktop, equal weight
**Status:** report only — no code was changed

---

## Summary

The storefront is in materially better shape than the seller console audited yesterday,
and the gap is not accidental. Several of that report's findings simply do not transfer:
product tiles are real `<a href>` links in most places, headings are disciplined and
deliberately maintained, back buttons state their destination honestly, toasts are
announced, and the image pipeline is the best-engineered thing in the repository.

Where the console's defects were *omissions repeated everywhere*, the storefront's are
**incomplete migrations** — a correct pattern was established in a shared component,
documented with its reasoning, adopted on most surfaces, and missed on a few. The missed
ones are disproportionately the pages that carry money.

Two findings block a keyboard user from completing a purchase at all.

| # | Finding | Severity | Reach |
|---|---|---|---|
| 1 | Payment method cannot be chosen by keyboard | **High** | Payment (every order) |
| 2 | Checkout has no `autocomplete` on any field | **High** | Checkout (every order) |
| 3 | Accent tokens used as text colour — 3.20:1 | **High** | 14 sites, all money lines |
| 4 | Hardcoded status text is unreadable in dark mode | **High** | 20+ sites |
| 5 | Homepage tiles are still `div onClick` | **Medium-High** | Home, Boutiques, ads |
| 6 | Sheets implement half of modal behaviour each | **Medium** | 13 sheets |
| 7 | Checkout's error affordances are below threshold | **Medium** | Checkout |
| 8 | 164 instances of sub-12px text | **Medium** | 29 files |
| 9 | Two post-purchase pages have no `h1` | **Medium** | OrderConfirmation, TrackOrder |
| 10 | 18 of 42 `ImageSlot` sites omit `sizes` | **Low-Medium** | Thumbnails |
| 11 | Good components that nothing uses | **Low** | ProductCard, ScreenHeader |
| 12 | Live region is mounted with its own content | **Low** | Whole app |

---

## 1. The payment method cannot be chosen by keyboard — High

`Payment.tsx:159` builds the payment method selector out of clickable `<div>`s:

```jsx
{PAY_METHODS.map((m) => {
  const on = payMethod === m.key;
  return (
    <div key={m.key} onClick={() => setPayMethod(m.key)} style={css(`…cursor:pointer;…`)}>
```

There is no `role`, no `tabIndex`, no `aria-checked` and no key handler. The control is
unreachable by Tab, unactivatable by Space or Enter, and announced as nothing. Since every
order is prepaid through Razorpay (rule 9), this is the last decision before payment — so
a keyboard-only or switch-access buyer cannot complete a purchase.

**The correct pattern already exists two files away.** `ProductDetail.tsx:848-861` builds
the size picker properly:

```jsx
<div role="radiogroup" aria-labelledby="agx-size-label">
  …
  <button role="radio" aria-checked={on} …>
```

`OrderFeedbackSheet.tsx:45-51` does the same for its rating. Those are the only two
`role="radiogroup"` uses in the buyer surface; the payment selector is the third place
that needs it and the one place it is missing.

**Recommended:** make each method a `<button role="radio" aria-checked>` inside a
`role="radiogroup"`, exactly as `ProductDetail.tsx:848` does. Arrow-key roving is a bonus,
not a requirement — reachability is.

---

## 2. Checkout has no `autocomplete` on any field — High

`Checkout.tsx:105-133` collects five values — name, phone, address, city, pincode — and
**none of the five carries an `autocomplete` attribute.**

The fields are otherwise well built: each `<input>` is wrapped in its own `<label>` (so
labelling is correct), and phone and pincode both set `inputMode="numeric"` so a phone
shows a number pad. The one attribute that is missing is the one that would let the
browser fill the address the buyer has already typed into a dozen other Indian
marketplaces.

**The codebase knows how to do this.** `AccountSheet.tsx` uses `autocomplete` correctly
five times (`email`, `one-time-code`, `new-password`, `current-password`), and
`DeliveryCheck.tsx:70` sets `autoComplete="postal-code"` on its pincode box. The single
screen where autofill is worth the most is the only significant form without it.

This is WCAG 2.1 AA SC 1.3.5 (Identify Input Purpose), but the conversion argument is the
stronger one: this is the highest-abandonment screen in any storefront, on a surface whose
buyers are overwhelmingly on phones, and it currently demands five manual entries that the
browser was ready to supply.

**Recommended:** `name`, `tel`, `street-address`, `address-level2`, `postal-code`.

---

## 3. Accent tokens used as text colour — High

`src/index.css:51-54` states the rule explicitly, in a comment written for exactly this
situation:

```
/* `--ag-good` is the fill/accent (dots, bars — 3:1 is enough); `--ag-good-text`
   [is the readable one] */
--ag-good: #2FA36B; --ag-good-bg: #E5F3EC; --ag-good-text: #1D7A4D;
```

`color:var(--ag-good)` nevertheless appears **23 times in the buyer surface, 14 of them on
real text** (the other 9 are icon glyphs, where 3:1 applies and it passes).

| Token | On light surface | On dark surface | As text (4.5:1) |
|---|---|---|---|
| `--ag-good` | **3.20:1** | 8.28:1 | **fails light** |
| `--ag-good-text` | 5.33:1 | 11.29:1 | ok |

The 14 text sites are almost perfectly correlated with money:

| Site | What it says |
|---|---|
| `DeliveryCheck.tsx:98` | `Free delivery` / `Delivery ₹NN` — the answer the box exists to give |
| `Cart.tsx:120,124` | cart savings line |
| `Checkout.tsx:176,180` | savings line |
| `Payment.tsx:202,204` | savings line |
| `Coupons.tsx:209,211` | coupon value |
| `DiscoveryPage.tsx:126`, `BoutiqueReviews.tsx:157`, `ProductReviews.tsx:268`, `OrderFeedbackSheet.tsx:209`, `Home.tsx:678` | ratings and confirmations |

`DeliveryCheck` is the one that matters most. Its own doc comment argues carefully that
asking for a pincode is the only never-wrong way to state a distance-priced charge (rule
3) — and then prints that hard-won number at 3.20:1 on the light theme.

**Recommended:** swap the 14 text sites to `--ag-good-text`. Leave the 9 icon uses alone.

---

## 4. Hardcoded status text is unreadable in dark mode — High

CLAUDE.md rule 4 requires `--ag-*` variables, never literal hex, because the theme
brightens colours for dark mode (`--ag-crimson` #B02454 → #E85088).

The buyer surface has 555 hex literals, but **most are legitimate** and should not be
touched — a distinction the raw count hides:

- **`#fff` on an opaque crimson fill (73 sites) is correct.** The fill is theme-independent.
- **`#fff` and `#F4D9A6` over the hero's photo scrims is correct.** `Home.tsx:331-332` lays
  two `rgba(38,6,20,…)` gradients under the copy; that background does not change with the
  theme, so neither should the text on it.
- **Tile tints (`TONES`) and `#D6336C` icon glyphs are fine.** The 20 `#D6336C` foreground
  uses are all `aria-hidden` Material Symbols or `accent-color` on a range input — non-text
  UI, judged at 3:1, where #D6336C measures 4.30:1 light and 4.23:1 dark and passes.

The real defect is narrower and worse. **Where a status container and its icon correctly
use tokens, the text between them is hardcoded** — so the panel flips for dark mode and
the words in it do not:

| Site | Text | On | Light | Dark |
|---|---|---|---|---|
| `TrackOrder.tsx:265,268` | "There's a problem with this delivery" | `--ag-bad-bg` | 6.09 | **2.10** |
| `Inspire.tsx:193` | offline error copy | `--ag-gold-bg` | 5.27 | **2.63** |
| `BestSellers.tsx:111`, `TopBoutiques.tsx:98` | rank caption | `--ag-gold-bg` | 5.88 | **2.36** |
| `Coupons.tsx:181` | boutique name chip | `--ag-gold-bg` | 5.57 | **2.49** |
| `MyOrders.tsx:104` | order status note | `--ag-gold-bg` | 5.27 | **2.63** |
| `BoutiqueProfile.tsx:292` | accent pill | `--ag-purple-bg` | 5.09 | **2.86** |
| `ProductReviews.tsx:231` | review submit error | `--ag-surface` | 5.48 | **3.34** |
| `Coupons.tsx:139`, `Payment.tsx:189` | "You save ₹NN on this order" | `--ag-good-bg` | **4.32** | **2.87** |
| `Checkout.tsx:197` | checkout validation error | `--ag-bg` | 4.60 | **3.96** |

`TrackOrder.tsx:265` is the worst case in the audit. At 2.10:1 the sentence telling a buyer
their parcel is being returned is close to invisible on a dark phone — and the comment
three lines above it explains that this panel was added precisely so the screen would stop
"quietly telling the buyer something that was no longer true."

The pattern is consistent enough to fix mechanically: in each of these, the sibling icon
already uses `var(--ag-bad-text)`, `var(--ag-gold-text)` or `var(--ag-good)`. The matching
`-text` token is the intended value.

---

## 5. Homepage tiles are still `div onClick` — Medium-High

`src/components/buyer/CardLink.tsx` exists solely to fix this, and its doc comment is
unusually clear about why:

> Product and boutique cards used to be `<div onClick={navigate}>`, which meant they were
> not links at all: they could not be reached by keyboard (tabbing a results grid skipped
> every card and landed only on the hearts), could not be opened in a new tab, had no
> address to copy or share…

It was adopted in `Results`, `Wishlist`, `CategoryLanding`, `BoutiqueProfile`,
`ProductDetail` and `DiscoveryPage`. It was **not** adopted on:

| Site | What it is |
|---|---|
| `Home.tsx:489` | New Arrivals rail |
| `Home.tsx:527` | second product rail |
| `Home.tsx:572` | Top Boutiques rail |
| `Home.tsx:297` | hero slide |
| `Boutiques.tsx:406` | boutique tile |
| `TopBoutiques.tsx:149` | boutique tile |
| `SponsoredStrip.tsx:41` | **paid ad inventory** |
| `MyOrders.tsx:176,188`, `TrackOrder.tsx:512`, `OrderConfirmation.tsx:62` | order rows |

`Home.tsx` contains **zero `<Link>` elements**. The most-visited page in the app offers a
keyboard user nothing to tab to except the wishlist hearts, and `SponsoredStrip` — the
inventory sellers pay for — has the same problem.

**This is not an SEO finding.** `middleware.js` prerenders a crawlable body with real
`<a href>` rows for every hub (`productLinkRows`, `boutiqueLinkRows`, `hubNav` at
`middleware.js:1512-1568`), and its comments show the orphan-URL problem was found and
solved deliberately. Googlebot is fine. The defect is for people using the app.

Counting all such elements: **43 `onClick` handlers on non-interactive elements** without
`role`+`tabIndex` or a key handler. Roughly two-thirds are sheet backdrops and
`stopPropagation` panels, which is a legitimate pattern (see #6); the ~15 above are
navigation targets and are not.

---

## 6. Sheets implement half of modal behaviour each — Medium

The buyer surface has 13 overlay sheets. The three things a modal owes a keyboard user are
implemented in **almost disjoint sets**:

| Sheet | `role="dialog"` | `aria-modal` | Escape closes | Focus moves in |
|---|---|---|---|---|
| AskMyPeopleSheet | yes | yes | no | no |
| ImageZoom | yes | yes | no | no |
| ReturnRequestSheet | yes | yes | no | no |
| InspireFilterSheet | yes | yes | yes | no |
| FeedPostCard | yes | no | no | no |
| FilterSheet (page) | no | no | yes | no |
| SortSheet | no | no | yes | no |
| AccountSheet, BuyerDetailsSheet, OrderFeedbackSheet, ProfileEditSheet, FilterSheet (cmp), StoryViewer | no | no | no | no |

`hooks/useDismissOnEscape.ts` exists and is well-argued — it cites WCAG 2.1.2 and notes the
filter sheet "is the densest screen in the app to be stuck inside". Three sheets use it.
The three sheets that correctly declare themselves modal dialogs are not among them.

**No sheet moves focus into itself on open, traps it, or restores it on close.** The 3
`.focus()` calls in the buyer surface are unrelated (OTP digit advance, a name field).
Opening a sheet therefore leaves the keyboard behind the scrim, on the page underneath.

**Recommended:** one `<Sheet>` wrapper carrying `role="dialog"`, `aria-modal`,
`aria-labelledby`, `useDismissOnEscape`, focus-in on mount and focus-restore on unmount.
Thirteen sheets is enough repetition to justify the component.

---

## 7. Checkout's error affordances are below threshold — Medium

Three things compound at `Checkout.tsx`:

**The error border is too faint on light.** `Checkout.tsx:89`:

```js
const errorRing = (bad) => (touched && bad ? '#E0748C' : 'var(--ag-border)');
```

`#E0748C` measures **2.98:1** against `--ag-surface` on the light theme — just under the
3:1 that WCAG 1.4.11 requires of a control boundary. (On dark it is 6.14:1 and fine.)
`--ag-danger-text` — the token that exists for this — measures 6.80:1 light and 8.35:1 dark.

**The message is a single summary at the bottom, not per-field.** `Checkout.tsx:197`
renders one sentence naming all five requirements at once:

> Enter your name, a 10-digit mobile number, full address and a valid 6-digit pincode to continue.

A buyer who mistyped only the pincode has to re-read all five and work out which one they
are being told about.

**Nothing is programmatically associated.** Across the entire buyer surface:
`aria-invalid` **0**, `aria-describedby` **0**. A screen reader on the pincode field
announces the label and nothing else.

Note this is *better* than the seller console's equivalent, where the error border was a
no-op `.replace()`. Here the border does change — it is just below the visible threshold in
one theme.

---

## 8. 164 instances of sub-12px text — Medium

| Size | Count |
|---|---|
| 11px | 46 |
| 11.5px | 43 |
| 10px | 30 |
| 10.5px | 29 |
| 9.5px | 8 |
| 8.5px | 4 |
| 7.5px | 2 |
| 8px / 9px | 2 |

Heaviest: `ProductDetail.tsx` 24, `Results.tsx` 13, `Home.tsx` 12, `SharedBoard.tsx` 7,
`Boutiques.tsx` 7, `DiscoveryPage.tsx` 7.

The smallest type is the `agx-eyebrow` treatment — uppercase, letterspaced labels at 7.5–9px
(`StoryRail.tsx:146`, `StoryViewer.tsx:177`, `ProductDetail.tsx:567` "Featured",
`Home.tsx:494` "New"). Letterspaced uppercase is a legitimate device and these are short
words, but 7.5px is below what a mid-range Android renders cleanly, and `ProductDetail.tsx:567`
and `Home.tsx:494` are badges that carry real information ("Featured", "New") rather than
decoration.

Unlike the seller console, the *error and hint* text here is mostly 12–12.5px, so the
instructions-are-the-smallest-type problem does not repeat. This is a legibility issue, not
a correction-blocking one.

---

## 9. Two post-purchase pages have no `h1` — Medium

Heading discipline on this surface is otherwise **good and actively maintained**.
`Home.tsx:239-251` carries a long comment explaining that the hero slide was demoted from
`h1` to `h2` because "an advert's slogan is an `h2` at most: the page still has exactly one
`h1`, which says what MangaiMart is." Files with several `<h1>` in source
(`Unsubscribe` 4, `CategoryLanding` 3, `ProductDetail` 2) are mutually-exclusive branches,
not duplicates. `BestSellers`, `NewArrivals`, `TopBoutiques` and `Collections` inherit theirs
from `DiscoveryPage`; `Messages` and `Notifications` from `ThreadList` and
`NotificationsInbox`.

Two pages genuinely have none:

- **`OrderConfirmation.tsx:54`** — a 34px Playfair `<div>` is visually the page title.
- **`TrackOrder.tsx:237`** — a 21px Playfair `<div>`, and `TrackOrder.tsx:208` defines a
  `sectionTitle` style reused 4 times for what are structurally `h2`s.

Below `h1` the outline is thin everywhere: **11 `<h2>` and 1 `<h3>` across 14,593 lines**.
`ProductDetail` (1,187 lines, ~8 accordion sections) and `TrackOrder` (639 lines) are the
pages where a heading-navigable outline would earn the most.

---

## 10. 18 of 42 `ImageSlot` sites omit `sizes` — Low-Medium

`src/lib/imageUrl.ts` and `src/components/ui/ImageSlot.tsx` are the strongest work in the
repository — see *What is already right*. The one gap is at the call sites.

`ImageSlot` defaults `sizes` to `(min-width: 768px) 320px, 50vw`, and its own doc warns that
overstating "only wastes bytes". 18 of 42 call sites take that default, and several are
small thumbnails where 50vw is a large overstatement:

| Site | Actual painted size |
|---|---|
| `TrackOrder.tsx:233,518` | order line thumbnail (~72px) |
| `Shortlists.tsx:125`, `ShortlistDetail.tsx:298` | shortlist tile |
| `SponsoredStrip.tsx:43` | 168px ad tile |
| `AskMyPeopleSheet.tsx:274`, `SharedBoard.tsx:264` | small tiles |

`MyOrders.tsx:193` shows the correct treatment for the identical component
(`sizes="72px"`), so the fix is a one-attribute copy at each site. On a 430px phone at DPR 3
the default asks for a 1280px candidate where 240px would do — worth roughly an order of
magnitude in bytes on order-history screens that show many rows.

Full-bleed and grid tiles taking the default are fine and should be left alone.

---

## 11. Good components that nothing uses — Low

- **`ProductCard.tsx`** is a well-built Tailwind product tile with `srcSet`, `sizes`, `alt`,
  explicit `width`/`height`, `loading="lazy"` and `decoding="async"`. It is imported only by
  the **chat** views. No catalogue surface uses it; they render tiles inline instead. Its own
  comment acknowledges the split ("the catalogue surfaces use the `css()` variants inline").
- **`ScreenHeader.tsx`** provides a titled header with a properly labelled
  `IconButton icon="arrow_back" aria-label="Go back"`. **Zero buyer pages use it**; all
  ten back controls are hand-rolled.

Neither is a bug today. Both are places where a future fix will have to be made twice, and
`ScreenHeader` is the natural home for the `h1` that #9 wants.

---

## 12. The live region is mounted with its own content — Low

Buyer toasts **are** announced, contrary to what a scan of `src/pages/buyer` alone suggests
— the live region lives in the shell. `AppShell.tsx:289-299`:

```jsx
{toast && (
  <div className="agx-toast" role="status"
       aria-live={toast.tone === 'error' ? 'assertive' : 'polite'}>
```

That is a good implementation: tone-aware politeness, a tone-aware icon, and
`ShopContext.tsx:228` holds error toasts for 3600ms against 2200ms for success.

The subtlety is that the element is **conditionally mounted**. A live region inserted into
the DOM in the same tick as its text is announced unreliably across screen readers — the
region needs to exist and be empty first, so the text arrives as a *change*. The same
pattern is in `AdminLayout.tsx:251`.

**Recommended:** render the wrapper unconditionally and toggle only its contents.

---

## Responsive posture

Good, and better than the seller console's. There are **no `@media` queries in any buyer
page or component** — but unlike the console, that is by design rather than by omission:

- **80 `@media` blocks in `src/index.css`** carry the breakpoints, via shared classes
  (`agx-rgrid`, `agx-scroll`, `agx-cart-sticky`, `agx-mob-actionbar`).
- **99 `clamp()` uses** in the buyer surface handle fluid type and spacing directly, so
  headings and hero copy scale continuously rather than stepping.
- **Safe areas are handled** — `env(safe-area-inset-bottom)` appears at `index.css:394, 444,
  486, 512, 520`, including an offset that lifts the toast above the cart's sticky bar.
- **`scroll-padding`** is set, which matters given 19 fixed/sticky elements and WCAG 2.2 AA
  *Focus Not Obscured*.

`Promote.tsx`'s intrinsic-grid instinct noted in the seller audit is the norm here rather
than the exception.

---

## What is already right

Stated plainly, because it constrains what the fixes should look like:

- **The image pipeline is exemplary.** `src/lib/imageUrl.ts` documents a measured problem
  (2.1 MB PNG behind a 390px slot; 6.7 MB on the home screen; LCP 5.9s on throttled 4G) and
  a measured fix (~22× on the largest asset), with reasoned choices for the width ladder,
  two quality tiers, and `resize=contain` so `object-fit` gets the whole frame.
  `ImageSlot.tsx` adds intrinsic `width`/`height` to hold layout (CLS was 0.15–0.30),
  a `priority` flag that eager-loads the LCP image, a lowercase `fetchpriority` with a
  comment explaining the React 18.3 prop-mapping trap, and a fallback for hosts that refuse
  cross-origin embedding. Both `priority` sites are correct (`Home.tsx:319`,
  `ProductDetail.tsx:634`, each `i === 0`).
- **Trust and conversion clarity is handled thoughtfully.** `DeliveryCheck` weighs three
  ways to present a distance-priced charge and picks the only one that is never wrong.
  Dispatch time is the seller's answer and transit is the platform's, kept visually
  separate (`ProductDetail.tsx:981`). Invented marketing copy was deliberately removed —
  "It used to print 'Handcrafted with intricate zari work' over any piece whose seller left
  it blank — a claim the platform had no basis for."
- **SEO is comprehensively handled server-side.** `middleware.js` (2,548 lines) prerenders
  crawlable bodies, injects JSON-LD, and its `hubNav` fixes orphan URLs with reasoning about
  sitelinks and internal link graphs. `npm run verify:seo` asserts crawler-visible meta.
- **Error handling is real**, unlike the console's. 37 error state variables, a dedicated
  `CatalogError` component, and no silent `catch {}` blocks.
- **`CardLink` and `useGoBack` exist and are used** — 4 buyer surfaces call `useGoBack`, and
  the remaining back controls carry visible destination labels ("My orders", "Continue
  shopping"), so none of them lies about where it goes.
- **Icon accessibility is correct** — 271 `aria-hidden` on decorative glyphs, and **zero**
  icon-only buttons without an accessible name across 247 parsed `<button>` elements.
- **Skip link and focus target** are correct in `AppShell.tsx:170,235`.
- **`prefers-reduced-motion`** is honoured in 6 places in `index.css`.
- **`aria-pressed` (9), `aria-current` (5) and `aria-label` (94)** show state and location
  are exposed on the surface generally — the gaps in #1 and #7 are specific, not systemic.

---

## Suggested order

Sequenced by buyer impact per unit of work:

1. **#1** — a keyboard user cannot pay. The correct pattern is at `ProductDetail.tsx:848`.
2. **#2** — five attributes, on the highest-abandonment screen in the app.
3. **#3** — 14 sites, mechanical: `--ag-good` → `--ag-good-text` on text only.
4. **#4** — ~20 sites, mechanical: each already has a sibling using the right token.
5. **#7** — one token swap for the border, then split the summary into per-field errors.
6. **#5** — wrap the remaining tiles in `CardLink`; start with `Home` and `SponsoredStrip`.
7. **#6** — one `<Sheet>` wrapper, then migrate 13 sheets to it.
8. **#9**, **#10**, **#8**, **#11**, **#12** — lower urgency, page by page.

Items 1 and 2 are the ones costing orders today. Items 3 and 4 are the ones where a buyer
on a dark phone is being shown something they cannot read — and in `TrackOrder`'s case,
that something is the news that their parcel is coming back.

---

*No code was changed in producing this report. Contrast figures are computed against the
actual theme values in `src/index.css` and each element's real container, not against the
page background by default. Line references are against `Selvakumar` at commit `a321550`.*
