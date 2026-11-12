/**
 * Shadowfax API client — the ONLY file that encodes their contract.
 *
 * Written against the real documentation at developer.shadowfax.in, read
 * 2026-11-12. The earlier version of this file was written against a guessed
 * REST shape; almost none of it survived. The corrections worth knowing:
 *
 *   • A REJECTED FORWARD ORDER COMES BACK AS HTTP 200. Their words: "Validation
 *     and business rejections on this API are returned with HTTP 200 and a
 *     message of Failure — a missing required field, an unserviceable pincode,
 *     and a replayed client_order_id all come back as 200. Branch on message,
 *     never on the status code." Branching on res.ok would read an unserviceable
 *     pincode as a success, then fail looking for an AWB — blocking the
 *     Shiprocket fallback on exactly the case it exists for.
 *   • TWO PRODUCTS, TWO HOSTS, TWO VOCABULARIES. Forward Logistics lives on
 *     dale.shadowfax.in/api; Hyperlocal Marketplace on api.shadowfax.in with
 *     entirely different paths, body shape and status strings. They share only
 *     the auth header.
 *   • `return_details` IS REQUIRED on every forward order. Omitting it rejects
 *     the order.
 *   • IDEMPOTENCY IS THEIRS. Replaying a client_order_id returns the existing
 *     order rather than creating a second parcel. That removes the worst
 *     failure mode the old design had to warn about.
 *
 * AUTH. `Authorization: Token <key>`, static, no expiry, generated from the SFX
 * 360 Partner Portal. OAuth2 client-credentials is also supported on both
 * products but buys us nothing — a static token needs no refresh and no cache
 * table, so there is deliberately no equivalent of shiprocket.ts's getToken().
 *
 * WHY AN EDGE FUNCTION AND NOT `api/`: `api/` holds exactly 12 routes, the
 * Vercel Hobby ceiling. A thirteenth fails the deploy.
 */

import { type ScanStage } from './courier.ts';

/* ── Hosts ────────────────────────────────────────────────────────────────── */

/** Forward Logistics. Note the `/api` suffix is part of the documented server
 *  URL, so endpoint paths below start at `/v3`, `/v4`, `/v1`. */
const FORWARD_BASE = Deno.env.get('SHADOWFAX_FORWARD_BASE_URL')
  ?? 'https://dale.staging.shadowfax.in/api';

/** Hyperlocal Marketplace — a different host entirely, and its paths carry
 *  their own `/api` prefix, so it is NOT included here. */
const HYPERLOCAL_BASE = Deno.env.get('SHADOWFAX_HYPERLOCAL_BASE_URL')
  ?? 'https://hlbackend.staging.shadowfax.in';

/**
 * The buyer-facing tracking page for a Forward Logistics AWB.
 *
 * Forward Logistics returns no tracking URL of its own, so the link is built
 * here rather than left null — a null means the order screen shows a docket
 * number the buyer cannot do anything with. Overridable by env because the
 * consumer tracker is a marketing URL, not an API contract, and we should not
 * need a redeploy if they move it.
 */
export function trackingUrlFor(awb: string): string | null {
  const code = awb.trim();
  if (!code) return null;
  const template = Deno.env.get('SHADOWFAX_TRACKING_URL_TEMPLATE')
    ?? 'https://track.shadowfax.in/#/tracking/{awb}';
  return template.replace('{awb}', encodeURIComponent(code));
}

/** Merchant code for the hyperlocal product, issued by Shadowfax. Unused by
 *  Forward Logistics, which identifies us by the token alone. */
function hyperlocalClientCode(): string {
  const code = Deno.env.get('SHADOWFAX_CLIENT_CODE');
  if (!code) throw new SfxError(500, 'SHADOWFAX_CLIENT_CODE is not set — required for hyperlocal orders');
  return code;
}

function apiKey(): string {
  const key = Deno.env.get('SHADOWFAX_API_KEY');
  if (!key) throw new SfxError(500, 'SHADOWFAX_API_KEY is not set on this project');
  return key;
}

/* ── Errors ───────────────────────────────────────────────────────────────── */

/**
 * Bad credentials, an unserviceable route and a down API are three different
 * problems with three different answers. `unserviceable` is the one the booking
 * function falls back to Shiprocket on without logging a fault.
 */
export class SfxError extends Error {
  status: number;
  body: unknown;
  unserviceable: boolean;
  constructor(status: number, message: string, body?: unknown, unserviceable = false) {
    super(message);
    this.status = status;
    this.body = body;
    this.unserviceable = unserviceable;
  }
}

/* ── Transport ────────────────────────────────────────────────────────────── */

/**
 * One authenticated call. Throws SfxError on a TRANSPORT or AUTH failure only.
 *
 * It deliberately does NOT treat a 2xx as success — on Forward Logistics that
 * is a business-level question answered by `message`, and each caller decides.
 */
async function sfxFetch<T>(
  base: string,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      method: init.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Token ${apiKey()}`,
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch (e) {
    // A network failure is not a refusal. The caller must be able to tell them
    // apart: one is worth falling back for, the other might mean the parcel was
    // created and we lost the answer.
    throw new SfxError(503, `Could not reach Shadowfax: ${(e as Error).message}`);
  }

  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  // Auth and server faults are genuinely HTTP-level on both products.
  if (res.status === 401 || res.status === 403) {
    throw new SfxError(
      res.status,
      `Shadowfax rejected our credentials (${res.status}) — check SHADOWFAX_API_KEY is the Partner Portal token for this environment`,
      body,
    );
  }
  if (res.status >= 500) {
    throw new SfxError(502, `Shadowfax ${path} is failing (${res.status})`, body);
  }
  // 400 on hyperlocal is a real validation error; on forward it is unusual but
  // possible. Either way the body carries the reason.
  if (res.status === 400) {
    const detail = readDetail(body);
    throw new SfxError(400, `Shadowfax ${path} rejected the request${detail ? `: ${detail}` : ''}`, body);
  }

  return body as T;
}

/** Their error shape differs by product: Forward returns `errors` as a plain
 *  string, Reverse an object keyed by field. Read both without assuming. */
function readDetail(body: unknown): string {
  if (!body) return '';
  const b = body as { errors?: unknown; message?: string; reason?: string; detail?: string };
  if (typeof b.errors === 'string') return b.errors;
  if (b.errors && typeof b.errors === 'object') {
    return Object.entries(b.errors as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
      .join('; ');
  }
  return b.reason ?? b.detail ?? b.message ?? '';
}

/* ── Service level ────────────────────────────────────────────────────────── */

export type ServiceLevel = 'hyperlocal' | 'surface';

/* ── Serviceability ───────────────────────────────────────────────────────── */

/**
 * Forward Logistics serviceability.
 *
 * `GET /v1/clients/serviceability/` answers PER PINCODE, not per pair — and
 * their docs are explicit that every leg is checked independently: "A pincode
 * serviceable for one leg is not necessarily serviceable for another." So both
 * pincodes go in one comma-separated call and BOTH must come back with a
 * service tier.
 *
 * Omitting `pincodes` returns their entire serviceable list, which is how to
 * get the coverage file without asking an account manager for it.
 */
export async function forwardServiceable(
  pickupPincode: string,
  dropPincode: string,
): Promise<boolean> {
  const body = await sfxFetch<{ code: number; services: string[] }[]>(
    FORWARD_BASE,
    `/v1/clients/serviceability/?service=marketplace&pincodes=${encodeURIComponent(`${pickupPincode},${dropPincode}`)}`,
  );

  const rows = Array.isArray(body) ? body : [];
  const covered = (pin: string) =>
    rows.some((r) => String(r.code) === pin && Array.isArray(r.services) && r.services.length > 0);

  return covered(pickupPincode) && covered(dropPincode);
}

/* ── Hyperlocal — WRITTEN BUT NOT WIRED ───────────────────────────────────────
 *
 * Everything from here to the end of the hyperlocal section is a working client
 * against their published Hyperlocal Marketplace documentation, and NOTHING
 * CALLS IT. `shadowfax-book` deliberately has no same-day branch, because a
 * dormant branch in a function that spends money is a branch that goes live one
 * day without anyone having tested it.
 *
 * Two things must be true before it can be wired in:
 *
 *   1. CHECKOUT MUST COLLECT A BUYER PIN. This product routes on
 *      drop_latitude/drop_longitude and accepts no address at all. We hold only
 *      free text plus a pincode; api/geo.js is IP-based and city-level. A rider
 *      sent to a pincode centroid in a town without street numbering is not a
 *      near miss, it is a failed delivery we pay for.
 *   2. PRODUCTION NEEDS A STATIC EGRESS IP. "Share your IP address list with
 *      Shadowfax to access production APIs." Supabase Edge Functions have none.
 *      Staging appears unrestricted, so this can be exercised there first.
 *
 * Kept rather than deleted because it is read off documentation that took real
 * work to pin down, and deleting it means re-reading all of it later.
 * ───────────────────────────────────────────────────────────────────────────── */

export type HyperlocalQuote = {
  serviceable: boolean;
  /** Estimated delivery cost including GST — the freight we will be charged.
   *  Unlike Forward, hyperlocal quotes this BEFORE the order is placed. */
  deliveryCost: number | null;
  pickupEtaMinutes: number | null;
  dropEtaMinutes: number | null;
  reason: string | null;
};

/**
 * Hyperlocal serviceability — and the price.
 *
 * Note it is a PUT, and that it takes coordinates rather than pincodes: this
 * product routes on lat/long, which is why it cannot be used for an order whose
 * buyer we have no pin for.
 *
 * Their docs: "Only when the response is serviceable: true should you place an
 * order — do so within a couple of minutes of the check." So the caller must
 * book immediately after, not cache this.
 */
export async function hyperlocalQuote(input: {
  pickupLat: number;
  pickupLng: number;
  dropLat: number;
  dropLng: number;
  orderValue: number;
  reference: string;
}): Promise<HyperlocalQuote> {
  const body = await sfxFetch<{
    serviceable?: boolean; serviceability?: boolean; delivery_cost?: number;
    pickup_eta?: number; drop_eta?: number; reason?: string;
  }>(HYPERLOCAL_BASE, '/api/v1/order-serviceability/', {
    method: 'PUT',
    body: {
      // Strings, per their schema — "converted to float" on their side.
      pickup_latitude: String(input.pickupLat),
      pickup_longitude: String(input.pickupLng),
      drop_latitude: String(input.dropLat),
      drop_longitude: String(input.dropLng),
      // Every order is prepaid (0085). 'true' means prepaid in their enum.
      paid: 'true',
      order_value: input.orderValue,
      COID: input.reference,
      stage_of_check: 'pre_order',
      rain_flag: false,
      client_surge: 0,
    },
  });

  return {
    serviceable: Boolean(body?.serviceable ?? body?.serviceability),
    deliveryCost: Number.isFinite(Number(body?.delivery_cost)) ? Number(body?.delivery_cost) : null,
    pickupEtaMinutes: Number.isFinite(Number(body?.pickup_eta)) ? Number(body?.pickup_eta) : null,
    dropEtaMinutes: Number.isFinite(Number(body?.drop_eta)) ? Number(body?.drop_eta) : null,
    reason: body?.reason ?? null,
  };
}

/* ── Booking ──────────────────────────────────────────────────────────────── */

/** Provider-neutral booking input. The booking function assembles this from our
 *  own rows and never sees a Shadowfax field name. */
export type BookingRequest = {
  reference: string;
  pickup: {
    name: string; phone: string; address: string;
    pincode: string; city: string | null; state: string | null;
    lat: number | null; lng: number | null;
  };
  drop: {
    name: string; phone: string; address: string;
    pincode: string; city: string | null; state: string | null;
    lat: number | null; lng: number | null;
  };
  items: { id: string; name: string; price: number; qty: number }[];
  declaredValue: number;
  /** Only used by the forward product, which prices on weight. */
  weightGrams: number;
  /** Required on a forward order when declaredValue >= 50000. */
  sellerGstin: string | null;
};

export type BookingResult = {
  sfxOrderId: string | null;
  awb: string;
  trackingUrl: string | null;
  freightCharge: number | null;
  riderName: string | null;
  riderPhone: string | null;
  /** Their promised delivery date, when they give one. Worth showing a buyer —
   *  it beats our generic transit estimate. */
  promisedDeliveryDate: string | null;
  rawStatus: string | null;
};

/**
 * Place a FORWARD (surface) order — `order_type: marketplace`.
 *
 * marketplace is the right type for this platform: the parcel is collected from
 * an independent seller, not our warehouse, and `return_details.return_type:
 * seller` sends a failed delivery back to that boutique rather than to a
 * warehouse we do not have.
 *
 * `order_type: hyperlocal` also exists on THIS api but is "restricted to
 * onboarded clients only" — the separate Hyperlocal Marketplace product below
 * is the documented route for same-day.
 *
 * Throws SfxError with `unserviceable: true` on a business rejection, which is
 * what the caller falls back to Shiprocket on.
 */
export async function bookForward(req: BookingRequest): Promise<BookingResult> {
  const body = await sfxFetch<{
    message?: string;
    data?: Record<string, unknown>;
    errors?: unknown;
  }>(FORWARD_BASE, '/v3/clients/orders/', {
    method: 'POST',
    body: {
      order_type: 'marketplace',
      order_details: {
        client_order_id: req.reference,
        product_value: req.declaredValue,
        // Prepaid always — cash was withdrawn platform-wide in 0085, and a
        // courier remitting collected cash to us would make the platform the
        // money handler.
        payment_mode: 'prepaid',
        cod_amount: 0,
        order_service: 'Regular',
        weight: req.weightGrams,
      },
      customer_details: {
        name: req.drop.name,
        contact: req.drop.phone,
        address_line_1: req.drop.address,
        city: req.drop.city ?? '',
        // Their examples send pincode as a NUMBER on customer_details.
        pincode: Number(req.drop.pincode),
        state: req.drop.state ?? '',
      },
      pickup_details: {
        pickup_type: 'seller',
        // name and contact are "additionally required when order_type is
        // marketplace" — which is always, for us.
        name: req.pickup.name,
        contact: req.pickup.phone,
        address_line_1: req.pickup.address,
        city: req.pickup.city ?? '',
        pincode: Number(req.pickup.pincode),
      },
      // REQUIRED on every order. 'seller' returns a failed delivery to the
      // boutique it came from, which for a marketplace is the only sane answer —
      // we hold no stock and have no warehouse to return to.
      return_details: {
        return_type: 'seller',
        name: req.pickup.name,
        contact: req.pickup.phone,
        address_line_1: req.pickup.address,
        city: req.pickup.city ?? '',
        pincode: Number(req.pickup.pincode),
      },
      product_details: req.items.map((it) => ({
        sku_name: it.name,
        sku_id: it.id,
        price: it.price,
        category: 'Apparel',
        // E-way bill is mandatory at or above ₹50,000, and at that value at
        // least one SKU must carry the seller's GSTIN. Sent only when we have
        // it, so a missing GSTIN surfaces as their own clear rejection rather
        // than as a malformed field.
        ...(req.sellerGstin ? { seller_details: { gstin_number: req.sellerGstin } } : {}),
      })),
    },
  });

  // THE IMPORTANT BRANCH. Not res.ok — `message`.
  if (body?.message !== 'Success') {
    const detail = readDetail(body) || 'Shadowfax declined this order';
    throw new SfxError(409, `Shadowfax declined this parcel: ${detail}`, body, true);
  }

  const d = (body.data ?? {}) as Record<string, unknown>;
  const awb = str(d, 'awb_number');
  if (!awb) {
    // message said Success but there is no AWB. Their idempotency means a
    // retry returns the SAME order rather than a second parcel, so this is
    // safe to retry — unlike the old guessed implementation, which had to warn
    // against it.
    throw new SfxError(502, 'Shadowfax reported success but returned no AWB number', body);
  }

  return {
    sfxOrderId: str(d, 'id'),
    awb,
    // Forward Logistics returns no tracking URL of its own; this is ours,
    // built from the AWB.
    trackingUrl: trackingUrlFor(awb),
    // Nor any freight figure at creation. Cost lands at invoicing, which is why
    // 0110's margin view tolerates a null `we_paid`.
    freightCharge: null,
    riderName: null,
    riderPhone: null,
    promisedDeliveryDate: str(d, 'promised_delivery_date'),
    rawStatus: str(d, 'status'),
  };
}

/**
 * Place a HYPERLOCAL (same-day) order.
 *
 * Needs coordinates for BOTH ends. The shop's come from its own dropped pin
 * (boutiques.latitude/longitude, 0076); the buyer's we do not currently
 * collect, which is why the caller must check for them and fall through.
 */
export async function bookHyperlocal(
  req: BookingRequest,
  quote: HyperlocalQuote,
): Promise<BookingResult> {
  if (req.pickup.lat == null || req.pickup.lng == null) {
    throw new SfxError(422, 'The shop has no map pin, so a same-day rider cannot be routed', null, true);
  }
  if (req.drop.lat == null || req.drop.lng == null) {
    throw new SfxError(422, 'This delivery address has no map location, so a same-day rider cannot be routed', null, true);
  }

  const body = await sfxFetch<{ message?: string; data?: Record<string, unknown> }>(
    HYPERLOCAL_BASE, '/api/v2/orders/', {
      method: 'POST',
      body: {
        client_code: hyperlocalClientCode(),
        order_details: {
          client_order_id: req.reference,
          order_value: req.declaredValue,
          paid: 'true',
          rain_flag: false,
        },
        pickup_details: {
          name: req.pickup.name,
          contact_number: req.pickup.phone,
          address: req.pickup.address,
          city: req.pickup.city ?? '',
          latitude: req.pickup.lat,
          longitude: req.pickup.lng,
        },
        drop_details: {
          name: req.drop.name,
          contact_number: req.drop.phone,
          address: req.drop.address,
          city: req.drop.city ?? '',
          latitude: req.drop.lat,
          longitude: req.drop.lng,
        },
        order_items: req.items.map((it) => ({
          id: it.id, name: it.name, price: it.price, quantity: it.qty,
        })),
      },
    },
  );

  const d = (body?.data ?? {}) as Record<string, unknown>;
  // Hyperlocal answers 201 on success and carries no `message: Success`
  // convention, so the presence of an identifier is what confirms it.
  const sfxOrderId = str(d, 'sfx_order_id') ?? str(d, 'id') ?? str(d, 'order_id');
  if (!sfxOrderId) {
    const detail = readDetail(body) || 'no order id returned';
    throw new SfxError(502, `Shadowfax did not accept the same-day order: ${detail}`, body, true);
  }

  return {
    sfxOrderId,
    // Hyperlocal has no AWB. The order id is the tracking handle, and our
    // schema requires a non-empty awb — so it stands in, prefixed so nobody
    // mistakes it for a surface docket.
    awb: `SFXHL-${sfxOrderId}`,
    trackingUrl: str(d, 'track_url'),
    // The quote's cost is what we are charged, and it already includes GST.
    freightCharge: quote.deliveryCost,
    riderName: str(d, 'rider_name'),
    riderPhone: str(d, 'rider_contact'),
    promisedDeliveryDate: null,
    rawStatus: str(d, 'status') ?? 'ACCEPTED',
  };
}

function str(d: Record<string, unknown>, key: string): string | null {
  const v = d?.[key];
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

/* ── Cancellation ─────────────────────────────────────────────────────────── */

/** Cancel a forward parcel. Accepts an AWB or our own client_order_id. */
export async function cancelForward(awbOrReference: string, remarks?: string): Promise<void> {
  await sfxFetch(FORWARD_BASE, '/v3/clients/orders/cancel/', {
    method: 'POST',
    body: { request_id: awbOrReference, cancel_remarks: remarks ?? 'Cancelled on MangaiMart' },
  });
}

/* ── Tracking, for the reconciliation sweep ───────────────────────────────── */

export type ScanRow = {
  awb: string;
  statusId: string;
  statusText: string;
  location: string | null;
  occurredAt: string | null;
  remarks: string | null;
};

/**
 * Track up to 50 forward parcels in one call.
 *
 * This exists because their callbacks are NOT retried — "a failed callback
 * delivery is not retried. Use Tracking to reconcile anything your endpoint
 * missed." A dropped `delivered` callback would otherwise leave an order
 * permanently short of delivered, and its seller permanently unpaid, with
 * nothing in the UI to explain why.
 */
export async function bulkTrackForward(awbs: string[]): Promise<Record<string, ScanRow[]>> {
  if (awbs.length === 0) return {};
  const body = await sfxFetch<{
    message?: string;
    data?: { order_details?: Record<string, unknown>; tracking_details?: Record<string, unknown>[] }[];
  }>(FORWARD_BASE, '/v4/clients/bulk_track/', {
    method: 'POST',
    body: { awb_numbers: awbs.slice(0, 50) },
  });

  const out: Record<string, ScanRow[]> = {};
  for (const entry of body?.data ?? []) {
    const events = entry?.tracking_details ?? [];
    for (const e of events) {
      const awb = str(e, 'awb_number') ?? str((entry.order_details ?? {}) as Record<string, unknown>, 'awb_number');
      const statusId = str(e, 'status_id');
      if (!awb || !statusId) continue;
      (out[awb] ??= []).push({
        awb,
        statusId,
        statusText: str(e, 'status') ?? statusId,
        location: str(e, 'location'),
        occurredAt: isoOrNull(str(e, 'created')),
        remarks: str(e, 'remarks'),
      });
    }
  }
  return out;
}

/** Their timestamps are ISO on tracking but " "-separated on callbacks. Without
 *  the T, parsing is implementation-defined — normalise, and drop rather than
 *  store an Invalid Date. */
export function isoOrNull(when: string | null): string | null {
  if (!when) return null;
  const parsed = new Date(when.includes('T') ? when : `${when.replace(' ', 'T')}Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/* ── Status vocabularies ──────────────────────────────────────────────────── */

/**
 * Forward Logistics `status_id` → our six stages.
 *
 * Mapped from their documented Core States table, on `status_id` (machine) and
 * never on `status` (human prose, which varies).
 *
 * The one that MUST be right: a MARKETPLACE order returns via `rts`/`rts_d`
 * (return to seller), NOT `rto`. An earlier version of this matched only the
 * string "RTO" and would have let a returned parcel pass as in-transit — and a
 * returned parcel that is not flagged releases a payout for a sale that never
 * happened.
 */
export function mapForwardStage(statusId: string): ScanStage {
  switch ((statusId ?? '').trim().toLowerCase()) {
    case 'picked':
      return 'picked_up';
    case 'ofd':
      return 'out_for_delivery';
    case 'delivered':
      return 'delivered';
    // Both return families. rts/rts_d is the marketplace path, rto/rto_d the
    // warehouse one; either means it did not reach the buyer.
    case 'rts': case 'rts_d': case 'rto': case 'rto_d':
      return 'rto';
    case 'lost':
      return 'failed';
    // Recoverable delivery holds: customer asked for another date, not
    // contactable, not attempted, on hold. Recorded as failed so the buyer sees
    // an attempt was made — our `failed` stage is deliberately inert in
    // apply_shipment_scan(), so it moves no order and releases no money.
    case 'cid': case 'nc': case 'na': case 'on_hold':
      return 'failed';
    // Back on the road after a failed attempt.
    case 'reopen_ndr':
      return 'in_transit';
    case 'new': case 'recd_at_fwd_hub':
      return 'in_transit';
    default:
      // A status we have never seen must never be the thing that moves an
      // order. Their docs warn of further values (QC failures, e-way bill
      // holds) that we deliberately do not enumerate.
      return 'in_transit';
  }
}

/**
 * Hyperlocal Marketplace status → our six stages. A completely separate
 * vocabulary from Forward Logistics; they share no values.
 */
export function mapHyperlocalStage(status: string): ScanStage {
  switch ((status ?? '').trim().toUpperCase()) {
    case 'DISPATCHED':
      return 'picked_up';
    case 'ARRIVED_CUSTOMER_DOORSTEP':
      return 'out_for_delivery';
    case 'DELIVERED':
      return 'delivered';
    case 'RETURNED_TO_SELLER':
      return 'rto';
    case 'CANCELLED': case 'CANCELLED_BY_CUSTOMER':
      return 'failed';
    // ACCEPTED, ALLOTTED, ARRIVED — the rider is on their way to the shop.
    default:
      return 'in_transit';
  }
}

/** Which vocabulary applies, from the shipment's own service level. */
export function mapStageFor(serviceLevel: ServiceLevel | null | undefined, raw: string): ScanStage {
  return serviceLevel === 'hyperlocal' ? mapHyperlocalStage(raw) : mapForwardStage(raw);
}
