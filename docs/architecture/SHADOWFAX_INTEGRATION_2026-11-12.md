# Shadowfax Integration — Design and Status

**Date:** 2026-11-12 (rewritten same day against the real API documentation)
**Status:** Built against the published contract at developer.shadowfax.in.
`tsc -b` 0 errors, `npm run build` passes. **Nothing has been run against Shadowfax.**
Migration `0110` **is applied**; `0112` is written and **NOT applied**. The three Edge
Functions are written and **NOT deployed**.
**Extends** `SHIPROCKET_INTEGRATION_2026-08-10.md`, which remains the fallback carrier and
is not modified by this work.

---

## 0. The plan in one paragraph

Shadowfax is the **second** carrier, **surface only** (Forward Logistics,
`order_type: marketplace`). The seller console calls one Edge Function, `book-parcel`, which
runs the chain **Shiprocket → Shadowfax → manual docket**. Booking stays **seller-triggered**.
Because Shadowfax never retries a callback, a scheduled **reconciliation sweep** — not the
webhook — is the system of record.

> **Demoted 2026-11-12.** Shadowfax led until a rural pincode came back unserviceable. That is
> not a Shadowfax defect — it is what every *single* carrier looks like; their own site
> advertises **16,681** of India's ~19,000 pincodes, and the missing ones skew rural, which is
> exactly where this marketplace's buyers are. Shiprocket is an **aggregator** and routes
> across several couriers per pincode, so its coverage is the union of theirs. Replacing
> Shadowfax with another single carrier (Bluedart, Delhivery, Ekart) would only have moved
> which villages failed. Shadowfax is kept as the second rung because every order it catches
> is one the seller does not have to enter a docket number for by hand.

**Same-day hyperlocal is deliberately out of scope for v1.** A working client exists in
`_shared/shadowfax.ts` and nothing calls it; see §2 for the two blockers and §6 for what comes
back with it.

---

## 1. The contract, as documented

| | Forward Logistics (surface) | Hyperlocal Marketplace (same-day) |
|---|---|---|
| Host | `dale.shadowfax.in/api` | `api.shadowfax.in` |
| Staging | `dale.staging.shadowfax.in/api` | `hlbackend.staging.shadowfax.in` |
| Auth | `Authorization: Token <key>`, static, no expiry | same |
| Serviceability | `GET /v1/clients/serviceability/?service=marketplace&pincodes=a,b` | `PUT /api/v1/order-serviceability/` (lat/long) |
| Place | `POST /v3/clients/orders/` | `POST /api/v2/orders/` |
| Cancel | `POST /v3/clients/orders/cancel/` | `PUT /api/v2/orders/{id}/cancel/` |
| Track | `GET /v4/clients/orders/{awb}/track/`, bulk `POST /v4/clients/bulk_track/` (50 max) | per-order details only |
| Routes on | pincodes | **coordinates** |
| Quotes price | no — cost lands at invoicing | **yes**, `delivery_cost` incl. GST, before booking |
| Statuses | `new`, `picked`, `recd_at_fwd_hub`, `ofd`, `delivered`, `cid`/`nc`/`na`/`on_hold`, `reopen_ndr`, `rts`/`rts_d`, `rto`/`rto_d`, `lost` | `ACCEPTED`, `ALLOTTED`, `ARRIVED`, `DISPATCHED`, `ARRIVED_CUSTOMER_DOORSTEP`, `DELIVERED`, `CANCELLED`, `CANCELLED_BY_CUSTOMER`, `RETURNED_TO_SELLER` |

Credentials come from the **SFX 360 Partner Portal** — self-serve, no sales call.

### Five things that bite

1. **A rejected forward order returns HTTP 200.** *"Validation and business rejections … are
   returned with HTTP 200 and a message of `Failure` … Branch on `message`, never on the
   status code."* Branching on `res.ok` reads an unserviceable pincode as success.
2. **They sign nothing.** No HMAC, no token, no fixed payload schema — the callback body is a
   per-client placeholder template. A signed Webhooks product is listed "Coming soon"; it is
   not what ships. See §3.
3. **Callbacks are never retried.** *"a failed callback delivery is not retried. Use Tracking
   to reconcile anything your endpoint missed."* See §3.
4. **`return_details` is required on every forward order.** Omitting it rejects the order.
5. **A marketplace order returns via `rts`/`rts_d`, not `rto`.** A mapper that only matches
   "RTO" lets a returned parcel pass as in transit — and an unflagged return releases a payout
   for a sale that never happened.

Two things in our favour: **their idempotency** (a replayed `client_order_id` returns the
existing order, so a retry cannot create a second parcel) and **`promised_delivery_date`** on
creation, which beats our generic transit estimate.

---

## 2. Why hyperlocal is out of scope for v1

Surface has neither problem. Hyperlocal has both — which is why the client is written but
**not wired into `shadowfax-book`**. A dormant branch in a function that spends money is a
branch that goes live one day without anyone having tested it, so there is no same-day path to
accidentally enable: there is simply no branch.

**A. We have no buyer coordinates.** Hyperlocal routes on `drop_latitude`/`drop_longitude`
and accepts no address. Checkout collects free text plus a pincode; `api/geo.js` is IP-based
and city-level. **Checkout must be changed to capture a pin**, and the columns to store it
belong in the same migration as that change rather than sitting unused now. Every order ships
surface until then — the correct degradation, since a rider sent to a pincode centroid in a
town without street numbering is a failed delivery we pay for.

**B. Hyperlocal production requires IP whitelisting.** *"Share your IP address list with
Shadowfax to access production APIs."* Supabase Edge Functions have no static egress IP.
Staging appears unrestricted, so it can be built and tested; production needs a static-IP
egress path (a small proxy VPS) or a different host for that one call.

---

## 3. The callback is not the system of record

Because Shadowfax never retries, one dropped POST loses that event permanently. If the lost
event was `delivered`, the order never reaches `delivered`, never satisfies `is_settleable()`,
and **the seller is never paid, with nothing in any console to explain why.**

So `shadowfax-reconcile` sweeps every 30 minutes: it lists in-flight surface parcels, calls
`bulk_track` in batches of 50, and replays each timeline through `apply_shipment_scan()` —
which is idempotent thanks to 0067's unique index plus `on conflict do nothing`. The webhook
is what makes it feel live; the sweep is what makes it correct.

**Webhook authentication.** They sign nothing, but the SF360 portal's "Add New Webhook" form
has an **"Authorisation Present"** setting offering **Basic Auth** or **Token** — so the
callback can carry a real `Authorization` header. Register it as **Token** with
`SHADOWFAX_WEBHOOK_SECRET`. The handler accepts `Authorization: Token`, `Basic`, `x-api-key`
and `?key=`, all compared in constant time; the weaker forms remain only so a misread portal
setting degrades to "still authenticated" rather than "every callback rejected and every
payout silently frozen". A shared secret proves possession, not that the body is untampered —
which is another reason the sweep, not the callback, is the system of record.

The same form's **Integration Type** must be set to **FWD Marketplace**, matching the
`order_type: marketplace` we book with. Staging and production URLs are configured separately
in one dialog.

---

## 4. What was built

| File | Role |
|---|---|
| `supabase/migrations/0110_shadowfax.sql` | **Applied.** provider widened, `service_level`, `sfx_*`, RTO columns, `shipment_freight_margin` view, both switches, `products.ready_to_ship`, COD guard widened to `provider <> 'manual'` |
| `supabase/migrations/0112_shadowfax_reconcile.sql` | **Not applied.** The pg_cron sweep — with 0094's placeholder guard, so a forgotten token raises instead of failing silently |
| `_shared/courier.ts` | Generic helpers shared by providers |
| `_shared/shadowfax.ts` | **The only file encoding their contract.** Both products, both status vocabularies — the hyperlocal half marked NOT WIRED |
| `book-parcel` | **The entry point.** Runs Shiprocket → Shadowfax → manual, server-side. Calls each carrier over HTTP forwarding the seller's JWT, so it holds no authority of its own |
| `shadowfax-book` | The Shadowfax rung. `skipFallback: true` stops it calling Shiprocket back and booking twice |
| `shadowfax-tracking` | Callback endpoint, URL-secret auth, writes only via `apply_shipment_scan()` |
| `shadowfax-reconcile` | The 30-minute sweep |
| `src/data/shipments.ts`, seller `OrderDetail`, admin `Deliveries`, buyer `TrackOrder` | Client side |

Removed when hyperlocal left v1: `src/lib/courierService.ts` (nothing imported it) and the
"Ready to ship today" toggle in `ProductForm`. The toggle promised buyers same-day delivery,
which v1 does not do — a seller switch with no effect is worse than no switch.
`products.ready_to_ship` stays in the database: `0110` is already applied, the column is
harmless, and it is what the toggle returns to.

`apply_shipment_scan()` is **not modified**. It was already provider-agnostic, and a second
provider must not mean a second way to mark an order delivered.

### No new mirrors

An earlier draft carried a third copy of `namesAgree` in `shadowfax-book`, to decide
hyperlocal-vs-surface from the delivery zone. Surface-only needs no zone decision, so that
copy is gone and `namesAgree` still has exactly its two existing homes
(`src/lib/nameMatch.ts` and `api/_pricing.js`). Wiring hyperlocal back in would reintroduce
it — worth remembering as part of that cost.

---

## 5. What the owner must do

1. **Create an SFX 360 Partner Portal account** and generate an API token. Self-serve.
2. **Apply `0112`** — replacing `<RECONCILE_TOKEN>` with the real secret first. It raises if
   you forget.
3. **Set the secrets** on the Supabase project — four for v1:
   `SHADOWFAX_API_KEY`, `SHADOWFAX_FORWARD_BASE_URL`, `SHADOWFAX_WEBHOOK_SECRET`,
   `SHADOWFAX_RECONCILE_TOKEN`.
   (`SHADOWFAX_HYPERLOCAL_BASE_URL` and `SHADOWFAX_CLIENT_CODE` are read only by the
   not-wired hyperlocal client; leave them unset.)
4. **Deploy three Edge Functions by hand** — `shadowfax-book`, `shadowfax-tracking`,
   `shadowfax-reconcile`. Committing the files does not deploy them.
5. **Register the callback** in SF360 → Integrations → Webhooks → Add New Webhook:
   - Client Push URL (staging and production separately):
     `https://<project>.supabase.co/functions/v1/shadowfax-tracking`
   - Authorisation Present: **Token**, value = `SHADOWFAX_WEBHOOK_SECRET`
   - Integration Type: **FWD Marketplace**
6. **Confirm the callback template** carries at least `client_order_id`, `awb_number`,
   `status_id`, `status`, `last_updated`, `current_location`, `rider_name`, `rider_contact`.
7. **Get the valid `service` value** for `/v1/clients/serviceability/` from support — every
   documented value returns `400 Invalid Request` (see §7). Not blocking; the check is
   advisory.
8. **Test on staging first**, then enable the platform switch and one shop.

---

## 7. Verified against the live staging API (2026-11-12)

Using a staging token from SF360 → Integrations → Authentication tokens:

| Check | Result |
|---|---|
| Bad token control | `401 Authentication credentials not provided` |
| Real token, tracking a dummy AWB | `400 Invalid AWB Number` — a business answer, so **auth, host and path are correct** |
| `GET /v4/clients/orders/{awb}/track/` | Live, path confirmed |
| `GET /v1/clients/serviceability/` | `400 Invalid Request` for `marketplace`, `regular`, `fwd`, `forward`, `standard`, and with no params |
| Coverage spot-check (portal) | `560034` and `624601` (Oddanchatram, TN tier-3) both serviceable |
| Account | SF360 client id `27094`, activated, wallet ₹0, no bank account (COD only — irrelevant, we are prepaid) |

**The serviceability result changed the code.** The booking function used to fall back to
Shiprocket whenever the check *failed*, which — given it fails for every known `service`
value — would have meant Shadowfax never carrying a single parcel while appearing fully
wired. The check is now advisory: a definite `false` still falls back, but an error means
"ask the real way" and we book. Order creation validates serviceability itself and answers
`message: Failure`, so nothing is lost.

---

## 6. Not built

**The same-day bundle**, which comes back together or not at all:
- **Checkout map pin** (blocker A) and **static-IP egress** (blocker B)
- Wiring `bookHyperlocal`/`hyperlocalQuote` into `shadowfax-book`, which reintroduces the
  `namesAgree` mirror and the zone decision
- The `ProductForm` "Ready to ship today" toggle and `src/lib/courierService.ts`
- The storefront same-day badge

**Independently of that:**
- **Admin UI for `rto_bearer`.** Columns and webhook capture exist; the control does not.
- **Weight-discrepancy reconciliation.** `declared_weight_kg` is stored; nothing compares it
  to what they bill.
- **Reverse Logistics.** Their 8-endpoint returns API maps well onto our existing
  `request_return()` flow (0078) and would automate return pickups. Out of scope here, worth
  its own pass.
