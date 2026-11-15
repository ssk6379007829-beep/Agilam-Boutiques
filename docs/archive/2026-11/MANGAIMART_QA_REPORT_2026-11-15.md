# MangaiMart — End-to-End QA Sweep

**Date:** 2026-11-15
**Branch:** `Selvakumar`
**Method:** Live walk of the running app (`npm run dev`, Vite 5 on `localhost:5173`)
driven through Playwright, pointed at the **live Supabase project** via the repo
`.env`. The sweep was deliberately **read-only** — no order placed, no account
created, no console mutation — because the data is production. Supplemented by a
full typecheck (`npm run build`), `npm run lint`, and code reading of the payout
path.

---

## 1. Verdict

The product is **substantially complete and in good shape**. Every page rendered,
there were **zero runtime console errors** across the whole anonymous buyer
journey, and both the TypeScript build and ESLint pass clean. There are no
"coming soon" stubs in the shipped UI.

What's missing is **not features** — it's (a) one seller-facing promise that
contradicts the actual payout maths, (b) test/seed rows visible to real buyers,
and (c) the parts that can only be proven with real credentials and real money,
which this sweep could not and should not exercise against production.

---

## 2. Automated checks

| Check | Result |
|---|---|
| `npm run build` (`tsc -b && vite build`) | **PASS** (exit 0) — full typecheck across buyer/seller/admin |
| `npm run lint` (eslint) | **PASS** (exit 0) |

*(Note: ran on Node v20.11.1; CLAUDE.md pins Node 24.x. Build succeeded anyway,
but CI/local should be on 24 to match production.)*

---

## 3. Buyer storefront — walked live, all green

| Step | Result |
|---|---|
| Home `/` | ✅ Renders, correct SEO `<title>`, hero + rails, Fraunces display face correct |
| Catalogue `/shop` | ✅ 14 products, filters, price slider, sort (Latest / Price / Popularity) |
| Product detail | ✅ Gallery, colour variants, verified-seller card, size guide, stock |
| Size validation | ✅ "Please select a size" toast fires when adding with no size |
| Delivery pincode check | ✅ Accepts pincode (tested 600001), recently-shipped serviceability UI works |
| Add to bag | ✅ Item lands in cart with size |
| Cart `/cart` | ✅ Qty stepper, order summary, coupons entry, delivery line, correct total |
| Checkout gate | ✅ Correctly blocked behind "Sign in to checkout" (orders require an account) |
| Auth modal | ✅ Email/phone + password, Google OAuth, remember-me, forgot-password, T&C/Privacy |

**Console across the entire walk: 0 errors, 2 benign React-Router v7 future-flag
warnings.**

## 4. Console boundaries

| Console | Result |
|---|---|
| Seller marketing `/sell` | ✅ Public site renders (light theme, take-home calculator, nav) |
| Admin `/<admin-path>` | ✅ Redirects to admin login; restricted-access card renders, email 2FA gated |

---

## 5. Findings (ranked)

### F1 — HIGH / trust · `/sell` promises sellers keep the delivery fee; the payout does not pay it

The seller landing page (`src/pages/sell/sellContent.ts`, rendered at `/sell`)
states, in the take-home card and body copy:

> "your delivery charge sits on top of this, **in full**"
> "**0%** of the delivery charge you set — that **stays yours in full**"

But the actual payout arithmetic in
[`PayoutStatement.tsx`](../../src/components/payouts/PayoutStatement.tsx#L126-L144)
computes a seller's transfer as **Order value − commission**. The delivery fee is
added back **only** on legacy COD orders (`o.isCod`). Since cash-on-delivery was
withdrawn in `0085`, **every current order is prepaid**, so the delivery charge
the buyer pays is collected by the platform and **never reaches the seller**.
This matches the documented model ("settles goods − commission to the seller")
and the known-issue record *platform-keeps-delivery-fee*.

**Impact:** the single most prominent number on the seller acquisition page is a
promise the system does not keep. This is a trust/▪legal exposure, not a cosmetic
bug.

**Decision needed (yours):** either the copy is wrong (fix `/sell` to stop
promising delivery pass-through) or the payout model is wrong (credit delivery to
sellers in `PayoutStatement` + the settlement function). These two sources must
be made to agree. Based on the business model and payout code, the **copy** is
the likely thing to correct.

### F2 — MEDIUM · Test/seed products are live in the buyer catalogue

`/shop` shows a product **"Crop top and pleated skirt crafted in raw silk fabric"**
(Arha fashion) priced at **₹1**, sitting next to an apparent duplicate of the same
title at ₹3,999. A ₹1 listing is buyable by a real customer and reads as broken
pricing. Recommend purging test rows before/at launch (`supabase/scripts/purge_seed.sql`
is the sanctioned path) or correcting the price.

### F3 — LOW / UX · "Email or phone" login label, but phone login is not wired

The buyer and seller sign-in field is labelled **"Email or phone"**, yet phone/SMS
OTP is unbuilt (plan only, blocked on TRAI DLT registration). A buyer entering a
phone number will fail. Until phone auth ships, the label should read "Email".

### F4 — INFO / benign · Stale `refresh_token` 400 on first load

A single `POST /auth/v1/token?grant_type=refresh_token → 400` fires on load from a
leftover browser session. Harmless for anonymous browsing; the app recovers to the
signed-out state. Not a product defect — noted so it isn't mistaken for one.

---

## 6. Not covered — needs real credentials / real money (and the real gaps)

This read-only sweep could **not** prove the following. They are the genuine
end-to-end unknowns:

1. **Checkout → Razorpay → `api/place-order.js`** — the final paid leg. Needs a
   real buyer account and a live payment; must not be run against production
   casually. This is the one buyer-flow segment still unverified here.
2. **Courier booking (DTDC) — still never exercised live.** `dtdc-book`,
   `dtdc-label`, `dtdc-cancel`, `dtdc-tracking`, `courier-serviceability` are all
   deployed and ACTIVE, but no real AWB has ever been generated. Fulfilment is the
   biggest "built but unproven end-to-end" area. *(`shadowfax-*` functions exist
   in the repo but are **not deployed** — loose end if Shadowfax is intended.)*
3. **Authenticated seller console** (Orders, ship sheet, Earnings, payouts) and
   **admin console** internals — behind auth, not walked. Build + lint cover their
   compilation; behaviour is unverified.
4. **Daily owner report cron** — known-broken (unsubstituted `<REPORT_TOKEN>`,
   silent 401; `0094` needs re-applying with the real token).

---

## 7. Recommended next actions

1. Resolve **F1** — decide copy-vs-model and make `/sell` and the payout agree.
2. Purge/fix the **₹1 and duplicate** test products (F2) before launch.
3. Fix the **"Email or phone"** label (F3) until phone auth ships.
4. Book **one real DTDC shipment** end-to-end to close the fulfilment unknown.
5. Re-apply **`0094`** with the real report token to restore the daily report.
