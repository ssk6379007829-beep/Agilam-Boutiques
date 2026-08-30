# Seller Console — UI/UX Audit

**Date:** 2026-08-28
**Scope:** all 23 pages in `src/pages/seller/` + 10 shared components in `src/components/seller/` (6,732 lines)
**Lenses:** accessibility, forms & feedback, flow & navigation, visual consistency
**Breakpoints:** mobile and desktop, equal weight
**Status:** audited 2026-08-28, **all 11 findings fixed 2026-08-29**. See
[Resolution](#resolution) at the foot of this document for what changed and how it
was verified.

---

## Summary

The console is built to a higher standard than most work of this kind. The theme system
is rigorous, destructive actions are handled consistently, and `useAsync` is a genuinely
well-designed data hook. The defects below are almost all **systemic** rather than
per-page: a small number of patterns, repeated 20–150 times.

The most serious finding is #1 — a correctness problem that presents as a UI problem,
where a seller could reasonably conclude their sales had vanished.

| # | Finding | Severity | Reach |
|---|---|---|---|
| 1 | Failed data loads render as legitimate-looking zeros | **High** | 27 of 28 `useAsync` sites |
| 2 | Form errors are visual-only — never announced or associated | **High** | Whole console |
| 3 | `INPUT_ERR` never changes the border it claims to | **High** | Every FormKit field |
| 4 | Hardcoded hex text fails WCAG AA in one or both themes | **High** | 45+ sites |
| 5 | Failed wizard validation doesn't move focus to the bad field | **Medium-High** | Onboarding (8 steps) |
| 6 | Back is a fixed destination, not history | **Medium** | 12 back buttons |
| 7 | No heading structure below `h1` | **Medium** | All 23 pages |
| 8 | Touch targets under 44px | **Medium** | Back buttons, qty steppers |
| 9 | 127 instances of sub-12px text | **Medium** | 29 files |
| 10 | Clickable `div`/`span` — not keyboard reachable | **Medium** | 19 sites |
| 11 | No component layer — states unexpressible inline | **Low-Medium** | 150 buttons |

---

## 1. Failed data loads render as legitimate-looking zeros — High

`useAsync` returns `{ data, loading, error, reload, refresh, refreshing }` and handles
failure correctly: a *foreground* failure sets `error`, while a background refresh
deliberately stays silent and keeps the last good data on screen. The hook is right.

**The console throws the error away.** Of 28 `useAsync` call sites, exactly one —
`Coupons.tsx:42` — destructures `error`. The other 27 discard it, so a foreground fetch
failure has no path to the screen anywhere else in the console.

`Analytics.tsx:54-56` is the worst case — all three fetches take only `data`, dropping
both `loading` and `error`:

```js
const { data: orderRows }    = useAsync(...)   // no loading, no error
const { data: productRows }  = useAsync(...)
const { data: customerRows } = useAsync(...)
```

There is no guard before render. On a failed load `orders` falls back to `[]`, and
`Analytics.tsx:82-83` computes `totalOrders = 0` and `totalRevenue = 0`, which the tile
array at line 123 renders as a fully-formed dashboard reading **"₹0 · Revenue"** and
**"0 · Orders"**.

That is visually identical to a genuinely quiet trading period. A seller cannot
distinguish a network failure from a month with no sales — and the most likely reading
of "₹0" is the alarming one.

Pages discarding `error` entirely: Analytics, Billing, Chat, Customers, Dashboard,
Earnings, Messages, MyProducts, OrderDetail, Orders, ProductAnalytics, Promote, Reviews,
PayoutHistory.

Also dropping `loading`, so they flash a zero-state before data arrives: Analytics,
Billing, Chat, Messages, and partially Dashboard, OrderDetail, Promote.

**Recommended:** surface `error` at every call site that owns a screen region, and
distinguish "we could not load this" from "there is nothing here". Analytics should not
render tiles at all until the first load resolves.

---

## 2. Form errors are visual-only — High

Across the entire seller surface:

| Attribute | Count |
|---|---|
| `aria-describedby` | **0** |
| `aria-invalid` | **0** |
| `aria-live` | **0** |
| `aria-hidden` | 171 |
| `aria-label` | 26 |
| `role=` | 3 (`status` ×2, `switch` ×1) |

`FormKit.tsx:66-68` renders error text in a `<span>` immediately after the input, which
is correct visually — but nothing connects the two. A screen reader reaching the input
announces the label and no error; the error text is only encountered later as loose
prose, if at all.

The 171 `aria-hidden` uses are *correct* — they sit on decorative Material Symbols icon
spans, which is exactly right. The gap is not carelessness about ARIA generally; it is
specifically that **state** is never exposed.

With `aria-live: 0`, the toast used for async save results is also never announced.

**Recommended:** give each field's error a stable id, point `aria-describedby` at it, set
`aria-invalid` when errored, and make the toast container a polite live region.

---

## 3. `INPUT_ERR` never changes the border it claims to — High

`FormKit.tsx:12`:

```js
const INPUT_ERR = INPUT
  .replace('var(--ag-border)', 'var(--ag-border)')          // ← replaces a token with itself
  .replace('background:var(--ag-surface)', 'background:var(--ag-surface-2)');
```

The first `.replace` is a no-op. The intent was clearly to swap the border to a danger
colour and the token was pasted twice. The result: an errored input has an **identical
border** to a valid one, and differs only by a swap from `--ag-surface` to
`--ag-surface-2` — a very low-contrast background change.

Combined with #2, an invalid field is signalled by a subtle background tint plus a line
of 11.5px red text that is not programmatically associated with it. Compounded further
by #5, where focus is never moved to that field.

**Recommended:** point the border at the danger token and keep the background change as a
secondary cue. Never rely on colour alone.

---

## 4. Hardcoded hex text fails WCAG AA in one or both themes — High

CLAUDE.md rule 4 says colours are `--ag-*` variables, never literal hex, "because a
hardcoded colour breaks dark mode". The theme file proves the point deliberately:
`--ag-crimson` is `#B02454` on light and is **brightened to `#E85088` on dark**, precisely
because the light crimson does not survive a dark background.

45+ sites in the console bypass that and hardcode the colour, so it never brightens.
Measured against the actual theme backgrounds (`--ag-bg` = `#FBF6F2` light, `#120A0E`
dark):

| Colour | On dark | On light | Verdict (normal text, AA 4.5:1) |
|---|---|---|---|
| `#D6336C` | 4.23:1 | 4.30:1 | **fails both** |
| `#B02454` | 3.00:1 | 6.06:1 | fails dark |
| `#8A2A34` | 2.29:1 | 7.95:1 | fails dark |
| `#2C6249` | 2.74:1 | 6.63:1 | fails dark |
| `#6A545E` | 2.83:1 | 6.43:1 | fails dark |
| `#4E688F` | 3.44:1 | 5.29:1 | fails dark |
| `#B26B1B` | 4.66:1 | 3.90:1 | fails light |
| `#CBB0BC` | 9.74:1 | 1.87:1 | fails light (decorative chevrons) |

`#D6336C` is the worst because it is the most used (18 text sites) and fails in *both*
themes. `Analytics.tsx:234` applies it at `font-size:11px`, compounding #9.

`#CBB0BC` is used for `aria-hidden` chevrons that signal "this row is tappable". As
non-text UI they fall under the 3:1 rule rather than 4.5:1, but 1.87:1 on light still
misses it.

Literal-hex counts per file — worst offenders: `Promote.tsx` 19, `SellerOnboarding.tsx`
15, `BillReceipt.tsx` 15, `Dashboard.tsx` 11, `ProductForm.tsx` 7.

Note that `#fff` on a crimson gradient fill (51 sites) is **fine** — the fill is opaque
and the pairing holds in both themes. The problem is specifically hex as a *foreground*
colour over a themed background.

---

## 5. Failed wizard validation doesn't move focus to the bad field — Medium-High

`SellerOnboarding.tsx:553-559`:

```js
const stepErrors = validateStep(step, form, ifscKnownBad);
if (Object.keys(stepErrors).length) {
  setErrors(stepErrors);
  toast('Please fix the highlighted fields');
  return;
}
```

The per-step validation itself is good — `validateStep` returns exactly which fields are
wrong, and the wizard is resumable via `onboarding_step`. But on failure the seller gets
a toast that does not name a field, and nothing scrolls or moves focus. The only
`scrollIntoView` in the console is at line 503, on *successful* step change.

On a long step the offending field can be off-screen, and given #3 its highlight is a
faint background tint. This is the classic "focusable error summary" case: an 8-step
wizard with roughly 40 inputs is exactly where it matters most.

**Recommended:** an error summary at the top of the step, focused on failed submit,
linking to each invalid field.

---

## 6. Back is a fixed destination, not history — Medium

`hooks/useGoBack.ts` exists specifically to make Back safe — it checks React Router's
`history.state.idx` and falls back to a route only on a cold deep link, so Back can never
walk the user out of the app. It is well-documented and correct.

**No seller console page uses it.** All 12 back buttons hardcode a destination:

| Page | Back goes to |
|---|---|
| AddProduct | `/seller/products` |
| Billing | `/seller/dashboard` |
| BoutiqueProfileEdit | `/seller/profile` |
| Customers | `/seller/profile` |
| Earnings | `/seller/profile` |
| Help | `/seller/profile` |
| OrderDetail | `/seller/orders` |
| ProductAnalytics | `/seller/products` |
| Settings | `/seller/profile` |
| Verification | `/seller/profile` |

The consequence is a Back button that lies. The Dashboard links straight to Earnings
(`Dashboard.tsx:126`), so a seller can go **Dashboard → Earnings → Back → Profile** and
land on a page they never visited. Same for OrderDetail reached from the Dashboard's
pending-orders card or from Messages: Back always claims they came from Orders.

**Recommended:** `useGoBack('/seller/dashboard')` at all 12 sites. The fallback keeps cold
deep links safe; history handles the rest.

---

## 7. No heading structure below `h1` — Medium

Every page has **exactly one `h1` and zero `h2`/`h3`**. All section titles are styled
`div`s. Screen reader users get no document outline and cannot navigate a page by heading
— which matters most on the longest pages (Onboarding 1,203 lines, Promote 692,
OrderDetail 593).

Seven pages have **no `h1` at all**: Chat, Notifications, OrderDetail, ProductAnalytics,
Search, SellerOnboarding, Verification.

---

## 8. Touch targets under 44px — Medium

The back button is uniformly `42×42` across all 12 pages that have one — just under the
threshold, consistently. Worse, `Billing.tsx:260-265` has three `28×28` controls in a row
(quantity −, quantity +, remove line), which is both under-size and under-spaced for
adjacent targets.

Other sub-44 interactive controls: `Coupons.tsx:145` (40px), `Coupons.tsx:211` (36),
`Coupons.tsx:247` (34), `Messages.tsx:134` (34), `MyProducts.tsx:258,287` (36),
`OrderDetail.tsx:269,276` (42), `OrderDetail.tsx:335,472` (38), `Orders.tsx:93` (38),
`Earnings.tsx:324` (40).

Note the console's marketing-site sibling gets this right — `.agx-sell-btn` sets
`min-height: 44px` with a comment citing WCAG 2.5.5. The console simply does not share it
(see #11).

---

## 9. 127 instances of sub-12px text — Medium

| Size | Count |
|---|---|
| 11.5px | 60 |
| 10.5px | 25 |
| 11px | 22 |
| 10px | 10 |
| 9.5px | 9 |
| 9px | 1 |

Heaviest: `ProductForm.tsx` 16, `Dashboard.tsx` 13, `Promote.tsx` 12,
`SellerOnboarding.tsx` 10, `Reviews.tsx` 8.

11.5px is the console's default for hint and error text (`FormKit.tsx:15-17`), so the text
carrying the *correction instructions* is the smallest text on the screen. On a mid-range
Android at typical viewing distance this is the first thing to become unreadable, and it
is disproportionately the text a seller most needs when stuck.

---

## 10. Clickable `div`/`span` — not keyboard reachable — Medium

19 sites attach `onClick` to a non-interactive element with no `role`, `tabIndex` or key
handler, so they cannot be reached or activated by keyboard at all:

Coupons 4, Messages 3, Billing 2, BoutiqueProfileEdit 2, Customers 2, MyProducts 2,
Analytics 1, Orders 1, ProductForm 1, TaxonomySelect 1.

`Billing.tsx:284` is a payment-method selector built from clickable `span`s — a genuine
choice control with no role, no `aria-pressed`, and no keyboard path.

---

## 11. No component layer — states unexpressible inline — Low-Medium

The console has **150 `<button>` elements and zero `className` attributes on any of
them**. Everything is an inline style string via the `css()` helper.

Inline styles cannot express `:hover`, `:focus-visible`, `:active` or `:disabled`. The
console therefore has no hover feedback and no disabled styling beyond manually-set
`opacity`, repeated at each call site.

Focus is *not* broken — `index.css:248` has a global catch-all covering
`a, button, input, textarea, [tabindex]` on `:focus-visible`, and the console inherits it.
But that is the only state it gets, and the ring colour there is a literal `#C7275E`.

For contrast, `src/pages/sell/` — the public "sell with us" marketing site — has a
fully-specified system in `index.css:1322-1470` (`.agx-sell-btn`, `.agx-sell-link`,
`.agx-sell-ledger`) generated from `docs/architecture/SELL_DESIGN_SYSTEM.md`, with all
five button states, 44px targets and tokens throughout. These are two legitimately
different surfaces with different design languages — the marketing site is not the
console — but the console is the one sellers use every day, and it is the one without a
component layer.

Total `className` usage across 6,732 lines of console: 42, nearly all layout utilities
(`agx-eyebrow` 12, `agx-lift` 7, `agx-scroll` 6, `agx-field` 3).

**Recommended:** a small `.agx-con-btn` family covering the three or four button shapes
actually in use. This is the change that would also fix #8 in one place.

---

## Responsive posture

There are **no `@media` queries in any console page or component**. Responsiveness comes
entirely from a handful of global grid classes, and only Dashboard opts in
(`agx-sd-stats`, `agx-sd-quick`, `agx-sd-split` — which do have breakpoints at 860px and
1000px in `index.css:240-245`).

Everything else is a single-column flow with `clamp()` used occasionally for spacing. That
degrades acceptably — it does not break, and there is no horizontal overflow — but on
desktop most pages are a narrow column in a wide viewport, and data-dense pages (Orders,
Customers, Reviews, Promote) leave the horizontal space unused where a second column would
genuinely help.

`Promote.tsx:410` is the one page using an intrinsically responsive grid
(`repeat(auto-fill, minmax(120px, 1fr))`), which is the right instinct.

---

## What is already right

Worth stating plainly, because it constrains what the fixes should look like:

- **Destructive actions are handled consistently and well.** Two-step inline confirm in
  MyProducts, OrderDetail and Promote. `Promote.tsx:70` documents the removal of the last
  `window.confirm` on the grounds that it "broke out of the app's own visual language".
  There are now zero native dialogs in the console.
- **`useAsync` is a genuinely good hook** — generation guards against out-of-order
  responses, structural equality to avoid pointless re-renders, and a deliberate policy
  that background failures stay silent while foreground ones surface. The problem in #1 is
  entirely at the call sites.
- **The theme system is rigorous**, with contrast ratios documented inline
  (`index.css:62`, `108`) and dark-mode values tuned against measurement — one comment
  records a token being changed from 4.34:1 to 5.41:1.
- **Onboarding is resumable**, with per-step validation and a review checklist of
  outstanding steps.
- **Bottom nav is 5 items** — Home, Products, Orders, Messages, Profile — within the ≤5
  guideline, with sensible `match` arrays so child routes highlight the right tab.
- **Icon accessibility is correct** — 171 `aria-hidden` on decorative glyphs.
- **A skip link and `#main-content` focus target exist** and are correctly implemented in
  AppShell.

---

## Suggested order

Sequenced by seller impact per unit of work, not by severity alone:

1. **#1** — highest consequence, and mechanical. Destructure `error` and render it.
2. **#3** — a one-line fix that restores a broken affordance across every form.
3. **#6** — swap 12 call sites to the hook that already exists.
4. **#4** — replace hex with tokens; the table above gives the failing set.
5. **#2** — needs a small change in FormKit, then propagates.
6. **#11 + #8** — introduce the button class; fixes touch targets in one place.
7. **#5**, **#7**, **#9**, **#10** — page-by-page, lower urgency.

Items 1–4 are the ones where a seller is currently being actively misled — about their
revenue, about which field is wrong, about where Back goes, and about what they can read
in dark mode.

---

---

## Resolution

All eleven findings were fixed on 2026-08-29. Line references in the body of this
report are against `Selvakumar` at `a321550` and so predate the fixes.

| # | Finding | What changed |
|---|---|---|
| 1 | Failed loads render as zeros | `error` is now destructured and rendered at every `useAsync` site that owns a screen region. New shared `src/components/seller/LoadError.tsx`, generalised from the block Coupons already had. Analytics gates its whole figure block behind `ready`; Dashboard shows `—` rather than `₹0` on all four stat tiles; ProductAnalytics flags a failed sales fetch instead of showing "0 sold"; OrderDetail and ProductAnalytics no longer say "not found" on a fetch failure. Twelve supporting lookups still discard `error` on purpose — a peer name that falls back to "Customer", a badge count, a courier list with its own `.catch` — none of which can render a misleading figure. |
| 2 | Errors visual-only | `FormKit` now mints an id per field, sets `aria-invalid`, and points `aria-describedby` at whichever note is rendered. `ChipPicker` gained `role="group"` + `aria-pressed`; `Toggle` gained `role="switch"` + `aria-checked`. |
| 3 | `INPUT_ERR` no-op | Border now resolves to `var(--ag-danger-text)`. The same latent bug in `TEXTAREA` was fixed alongside it (`TEXTAREA_ERR`). |
| 4 | Hex fails AA | 41 foreground colours replaced with theme tokens. **Three literals kept on purpose** — the Promote ad-preview scrim and the onboarding crimson header, both already commented as intentional. **`BillReceipt.tsx` excluded entirely**: it is captured to a PNG on a fixed white card and its header documents that tokens broke it before. |
| 5 | No focus on failed validation | New `src/lib/focusInvalid.ts`; called from the onboarding wizard (both the account step and every later step), Settings, and ProductForm. It keys off `aria-invalid`, so it needs no per-form knowledge. |
| 6 | Back is a fixed destination | All 11 back buttons now call the existing `useGoBack(fallback)`. The fallback preserves cold-deep-link safety; history handles the rest. |
| 7 | No heading structure | `SectionCard`'s title is now an `<h2>` (one change, 38 call sites). `h1` added to OrderDetail, ProductAnalytics, Verification, SellerOnboarding, and a visually-hidden one to Search. Chat and Notifications delegate to shared components whose headings live outside the console — left alone. |
| 8 | Touch targets | Back buttons 42→44px. Billing's 28px quantity steppers and the three 36px modal close buttons →44px. Twelve remaining controls given a `min-height:44px` floor. Decorative 40/42px tiles left as they were. |
| 9 | 127 sub-12px instances | Two floors applied: micro-labels (tracked eyebrows, badges) → 11px, reading text → 12px. Console now bottoms out at 11px; `BillReceipt` keeps its own print scale. |
| 10 | Clickable `div`/`span` | Nine genuine controls converted to `<button>` — order/customer/conversation/product rows, the payment-method and size chips (with `aria-pressed`), the customer expander (`aria-expanded`), and both image pickers. |
| 11 | No component layer | New `.agx-con-btn` / `.agx-con-icon` / `.agx-con-row` family in `index.css`, with hover, active, `:focus-visible` and a single `:disabled` definition replacing the hand-rolled opacity at 8 call sites. 19 CTAs and 7 icon buttons adopted. |

**Corrected on review (2026-08-30):** four of the nine `div`→`button` conversions
shipped without a chrome reset — Analytics' most-viewed rows, Billing's product
picker, the Messages conversation row and Customers' order rows. A bare `<button>`
inherits the UA `buttonface` fill, an outset border and `buttontext` colour, and
`index.css` has no global button reset, so all four would have rendered as grey
boxes in both themes. They now carry `.agx-con-row`, the class written for exactly
this and previously used at only one of the ten row sites.

**Also fixed, found during the work:** no console overlay handled Escape. The
existing `useDismissOnEscape` hook is now wired into the Coupons editor and its
delete confirm (stacked, so the top one answers first), the MyProducts editor,
the Promote delete confirm, the Messages row menu, and TaxonomySelect.

### Verification

- `npm run build` — passes (`tsc -b && vite build`, clean).
- `npm run lint` — 0 errors, 38 warnings; **identical to the pre-change baseline**
  measured by stashing the work and re-running, so nothing here added a warning.
- Not verified: no browser pass was run. The contrast figures are computed from
  the theme values, not sampled from a rendered page, and the visual result of the
  type-scale and touch-target changes has not been looked at.

### One deliberate non-change

`BillReceipt.tsx` keeps all 15 of its literal colours. It is a document printed to
a white card and captured to an image; the file's own header records that using
`--ag-*` tokens previously made the buyer's name and totals near-invisible in the
shared PNG. Re-tokenising it would have re-introduced a bug someone had already
fixed.*
