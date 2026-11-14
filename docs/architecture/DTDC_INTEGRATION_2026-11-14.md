# DTDC Integration — Design and Status

**Date:** 2026-11-14
**Status:** Built against the API Playground inside the DTDC Customer Portal, read the same day
for customer code `GL24686` (account opened 2026-11-14). `tsc -b` and `npm run build` pass.
**Nothing has been run against DTDC.** Migrations `0114` and `0115` are written and **NOT
applied**. The three Edge Functions are written and **NOT deployed**; `book-parcel` is changed and
needs redeploying.
**Extends** `SHADOWFAX_INTEGRATION_2026-11-12.md` and `SHIPROCKET_INTEGRATION_2026-08-10.md`,
which remain the fallback carriers and are not modified.

---

## 0. The plan in one paragraph

DTDC is the platform's **contracted primary carrier**: one account, one rate card, one monthly
invoice, pickup from the boutique's own address. `book-parcel` now runs the chain
**DTDC → Shiprocket → Shadowfax → manual docket**. Booking stays **seller-triggered**. The label
PDF is captured at booking into a private bucket and the seller gets a **Print label** button.
Tracking is **pull-first**: a 30-minute reconcile sweep is the system of record, and a webhook
endpoint exists for when DTDC/Shipsy configure push on their side.

---

## 1. The contract, as documented

DTDC's customer API is the **Shipsy** platform white-labelled. The playground names the API
server as `https://app.shipsy.in`; every path is `/api/customer/integration/consignment/…`;
auth is a static `api-key` header. Four operations are exposed to a customer account:

| Operation | Call | Notes |
|---|---|---|
| Create | `POST …/upload/softdata/v2` | Single consignment object. Reply `{ success, reference_number, courier_partner, … }` — `reference_number` **is the AWB**. Also accepted: the older `{ status:'OK', data:[…] }` wrapper. |
| Track | `GET …/track?reference_number=` | `{ status, events:[{ type, event_time (epoch ms), hub_name, customer_update, failure_reason }] }`. No bulk form. |
| Label | `GET …/shippinglabel/stream?reference_number=` | `application/pdf` bytes (4x6). |
| Cancel | `POST …/cancel` | `{ AWBNo:[…], customerCode }` → `{ status, success, successConsignments, failures }` |

Also in the catalogue but **not** shown to this account by default: pickup create/update
(`/api/customer/integration/pickup/create`), softdata update, and the **Consignment Status
Webhook** (auth `x-api-key`, ~50 event types, reply `{ "statusCode": "200" }`).

### Five things that bite

1. **Business rejections are HTTP 400** with `{ error: { message, reason, code } }`. Any 400 is
   a refusal of *this parcel* and the chain moves to the next carrier. A 401 is credentials.
2. **`success:false` can arrive on a 200.** The adapter branches on `success` /
   `reference_number`, never on the status code alone.
3. **`hub_code` is marked required** on the v2 schema. It is a DTDC-side routing hint. Sent only
   when `DTDC_HUB_CODE` is set, so a wrong guess cannot misroute every parcel; if they insist,
   their 400 says so and the owner sets it.
4. **`service_type_id` is account-specific.** Only services on the rate card are accepted
   (e.g. `B2C PRIORITY`, `GROUND EXPRESS`). Read from `DTDC_SERVICE_TYPE_ID`; the function
   declines (and the chain moves on) rather than guess.
5. **Three time formats.** Epoch milliseconds in tracking, epoch seconds in `*_epoch` webhook
   fields, ISO or `YYYY-MM-DD HH:mm:ss` in `event_time`. One helper, `toIso()`.

Two things in our favour: the account's **API key is self-serve** (pre-filled in the playground's
REQUEST HEADERS field — it is the real key, not an example), and the API returns the AWB
synchronously, so there is no "order created, AWB pending" state to handle.

---

## 2. What was built

| File | Role |
|---|---|
| `supabase/migrations/0114_dtdc.sql` | **Not applied.** `provider` admits `'dtdc'`; `dtdc_courier_partner`, `label_path`; both switches with the column grant; DTDC tracking template on the `couriers` row; private `shipping-labels` bucket with owner/admin read policies |
| `supabase/migrations/0115_dtdc_reconcile.sql` | **Not applied.** Schedules the sweep at :15/:45 via `require_cron_secret('dtdc_reconcile_token')`. Refuses until 0113, 0114 and the Vault secret exist |
| `_shared/dtdc.ts` | **The only file encoding their contract.** Config, transport, create/track/label/cancel, time parsing, the event→stage map |
| `dtdc-book` | The DTDC rung. Ownership checks, softdata upload, label capture to Storage, shipment row, order → shipped. Declines come back as `{ declined, reason }` 409 |
| `dtdc-tracking` | Webhook endpoint. `x-api-key` compared in constant time; writes only via `apply_shipment_scan()` |
| `dtdc-reconcile` | The sweep: one `track` per in-flight parcel, oldest first, 150 a run, replayed through `apply_shipment_scan()` |
| `book-parcel` | **Changed.** DTDC is rung 1; Shiprocket now reports `fellBack` when DTDC declined first |
| `src/data/shipments.ts` | `'dtdc'` provider, `label_path`, `fetchDtdcAvailability`, `saveBoutiqueDtdc`, `signedLabelUrl`, switch/shop ladders widened |
| seller `OrderDetail` | DTDC availability feeds the ship sheet; **Print label** button (signed URL on click) |
| admin `Deliveries` | DTDC master switch above Shiprocket's; per-shop checkbox; "BOOKING" column reads DTDC first |
| `src/types/database.ts` | The new columns |

`apply_shipment_scan()` is **not modified**. It was already provider-agnostic, and a third
provider must not mean a third way to mark an order delivered.

### Event → stage

| Shipsy `type` | Our stage |
|---|---|
| `softdata_upload`, `pickup_scheduled`, `pickup_awaited`, `out_for_pickup`, … | *skipped* — no "booked" stage; a parcel must not read as moving before pickup |
| `pickup_completed` | `picked_up` |
| `inscan_at_hub`, `outscan_at_hub`, `intransittohub`, `reachedathub`, `handover_courier_partner`, … | `in_transit` |
| `accept`, `assigned_for_delivery`, `startfordelivery` | `out_for_delivery` |
| `delivered`, `delivery_pod` | `delivered` |
| `attempted`, `on_hold`, `exception`, `not_picked_up`, `lost`, `seized`, … | `failed` (inert: moves no order, releases no money) |
| `rto`, `rto_initiated`, `rto_in_transit`, `rto_delivered`, … | `rto` → delivery dispute, payout frozen |
| `cancelled`, `revert_from_delivered`, `revoke_rto` | *skipped and logged* |
| anything else | `in_transit` — an unknown status never moves an order |

---

## 3. Decisions taken (defaults — overrule any of them)

| Decision | Value | Why |
|---|---|---|
| Chain position | **DTDC first**, aggregator second | Contracted carrier; a single carrier still has rural gaps, so the chain stays |
| Service type | **One**, from `DTDC_SERVICE_TYPE_ID` | Account-specific; a wrong value fails loudly and falls through rather than booking the wrong product |
| Pickup | **`action_type: single_pickup`** on the softdata upload | The documented default manifestation; the separate pickup API is not shown to this account |
| Tracking | **Sweep is the system of record**, webhook optional | Webhook registration is on DTDC/Shipsy's side, on request |
| Label | **Stored in a private bucket**, signed on click | It carries the buyer's address and phone; the stream endpoint needs the api-key so the seller cannot open it directly |
| Buyer delivery price | **Untouched** — the seller's distance bands (CLAUDE.md rule 3) | DTDC's freight is a platform cost on the monthly invoice, not a buyer price |
| Freight cost | **Not recorded** per parcel | The booking reply carries no price; `shipment_freight_margin` already tolerates a null |
| Cancellation | **Not wired** | See §5 |

---

## 4. What the owner must do

1. **Change the portal password.** The temporary one was pasted into a chat on 2026-11-14.
2. **Set the Edge Function secrets** on the Supabase project:
   - `DTDC_API_KEY` — the value pre-filled in the playground's `api-key` field
   - `DTDC_CUSTOMER_CODE` = `GL24686`
   - `DTDC_SERVICE_TYPE_ID` — the product on your rate card, exactly as DTDC names it
   - `DTDC_WEBHOOK_SECRET`, `DTDC_RECONCILE_TOKEN` — two fresh random strings
   - Optional: `DTDC_HUB_CODE`, `DTDC_COMMODITY_ID`, `DTDC_BASE_URL`, `DTDC_TRACKING_URL_TEMPLATE`
3. **Apply `0114`** in the SQL editor.
4. **Deploy four Edge Functions by hand** — `dtdc-book`, `dtdc-tracking`, `dtdc-reconcile`, and
   `book-parcel` (changed). Committing the files does not deploy them.
5. **Add the Vault secret, then apply `0115`** (needs `0113` applied first):
   ```sql
   select vault.create_secret('<DTDC_RECONCILE_TOKEN>', 'dtdc_reconcile_token');
   ```
6. **Switch on** the DTDC master switch (admin → Deliveries → Shiprocket tab) and **one shop**.
7. **Book one real test parcel** from that shop's console and check: the AWB appears, the label
   opens, the consignment shows in the DTDC portal, and a pickup is raised. If the upload is
   rejected, the reason is in the toast and the function log — the two likely causes are
   `service_type_id` and `hub_code`.
8. **Ask DTDC/Shipsy to register the status webhook** —
   `https://<project>.supabase.co/functions/v1/dtdc-tracking` with header
   `x-api-key: <DTDC_WEBHOOK_SECRET>`. Until then the sweep carries the whole load.
9. **Verify the buyer tracking link** opens: `couriers.tracking_url_template` was filled with
   DTDC's public tracker URL; if it does not resolve, correct it from the admin couriers tab and
   set `DTDC_TRACKING_URL_TEMPLATE` to match.

---

## 5. Not built

- **Cancel-before-pickup.** `cancelConsignments()` exists in the adapter and nothing calls it.
  Wiring it means reverting an order from `shipped` and deleting its shipment row, which touches
  the 0063/0072 state rules and deserves its own pass.
- **Pickup rescheduling** via the pickup API, if `single_pickup` turns out not to raise one.
- **Reverse pickup** for returns (`consignment_type: reverse`), which would automate 0078's
  `request_return()` flow.
- **Freight reconciliation** against the monthly DTDC invoice.
- **Serviceability pre-check.** The playground exposes no customer-side serviceability call; the
  upload's own 400 is the check.

---

## 6. Verified against the live portal (2026-11-14)

| Check | Result |
|---|---|
| Login with the issued credentials | Works; account `GL24686 - MANGAIMART`, type B2C, created 2026-11-14 06:32 UTC |
| API Playground | Four customer operations listed above, server `https://app.shipsy.in`, key pre-filled |
| Full OpenAPI catalogue | Captured from `app.shipsy.in/api/apidoc/getPxApiSpecification` (not committed — it is Shipsy's) |
| Account settings | No consignor address, GSTIN, or bank details on file yet |
| Pickup slots offered by the portal | 12:00–14:00 through 22:00–23:59, two-hour windows |
| Live API call | **Not made.** The sandboxed shell has no network, and the portal became unreachable before the playground's TRY could be used. The first real booking is the first live call. |
