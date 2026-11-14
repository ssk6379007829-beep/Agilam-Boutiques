/**
 * DTDC API client — the ONLY file that encodes their contract.
 *
 * Written against the API Playground inside the DTDC Customer Portal
 * (customer.dtdc.in → API Playground), read 2026-11-14 for customer code
 * GL24686. DTDC's customer API is the Shipsy platform white-labelled: the
 * playground names `https://app.shipsy.in` as the API server and every path
 * starts `/api/customer/integration/consignment/…`. Four operations are
 * exposed to a customer account:
 *
 *   POST /upload/softdata/v2   — create a consignment; the reply carries the AWB
 *   GET  /track                — the consignment's event history
 *   GET  /shippinglabel/stream — the label as a PDF stream
 *   POST /cancel               — cancel one or more consignments
 *
 * AUTH. A static `api-key` header. The key is shown pre-filled in the
 * playground's REQUEST HEADERS field (it is the account's real key, not an
 * example). It never expires, so there is no token cache.
 *
 * THINGS THAT BITE
 *   • Business rejections are HTTP 400 with `{ error: { message, reason, code } }`.
 *     Any 400 is a refusal of THIS parcel, and the booking chain falls through
 *     to the next carrier on it rather than showing the seller an error.
 *   • The softdata reply has appeared in two shapes across Shipsy versions:
 *     `{ success, reference_number, … }` (v2, documented) and
 *     `{ status: 'OK', data: [{ success, reference_number, … }] }` (v1).
 *     Both are read. `success: false` on a 200 is a rejection — branch on it,
 *     never on the status code alone.
 *   • `hub_code` is marked required on the v2 schema but is a DTDC-side
 *     routing hint for the pickup branch. It is sent only when DTDC_HUB_CODE
 *     is set, so a wrong guess cannot misroute every parcel; if they insist on
 *     one, their 400 says so and the owner sets it.
 *   • Event times in tracking are EPOCH MILLISECONDS; in the webhook they are
 *     ISO strings or epoch SECONDS. Three formats, one helper (`toIso`).
 *
 * WHY AN EDGE FUNCTION AND NOT `api/`: `api/` holds exactly 12 routes, the
 * Vercel Hobby ceiling. A thirteenth fails the deploy.
 */

import { type ScanStage } from './courier.ts';

/* ── Configuration ────────────────────────────────────────────────────────── */

/** The playground's "API Server". Overridable in case DTDC moves customers to
 *  a dedicated host (dtdcapi.shipsy.io has been used in the past). */
const BASE = (Deno.env.get('DTDC_BASE_URL') ?? 'https://app.shipsy.in').replace(/\/+$/, '');

function required(name: string): string {
  const v = (Deno.env.get(name) ?? '').trim();
  if (!v) throw new DtdcError(500, `${name} is not set on this project`);
  return v;
}

export function apiKey(): string { return required('DTDC_API_KEY'); }
/** The customer code DTDC issued — GL24686 for this platform. */
export function customerCode(): string { return required('DTDC_CUSTOMER_CODE'); }
/** Which DTDC product carries the parcel — e.g. "B2C PRIORITY" or "GROUND
 *  EXPRESS". Account-specific: only the services on the rate card are
 *  accepted, so this is configuration rather than a constant. */
export function serviceTypeId(): string { return required('DTDC_SERVICE_TYPE_ID'); }
/** Optional. See the header comment. */
export function hubCode(): string | null { return (Deno.env.get('DTDC_HUB_CODE') ?? '').trim() || null; }
/** Optional. Some Shipsy tenants require a commodity id for NON-DOCUMENT
 *  loads; the portal's "Commodity Type" dropdown lists this account's. */
export function commodityId(): string | null { return (Deno.env.get('DTDC_COMMODITY_ID') ?? '').trim() || null; }

/**
 * Buyer-facing tracking page for a DTDC AWB.
 *
 * The API returns no tracking URL of its own. DTDC's public tracker takes the
 * consignment number in the query string; overridable by env because a
 * marketing URL is not an API contract and should not need a redeploy.
 */
export function trackingUrlFor(awb: string): string | null {
  const code = awb.trim();
  if (!code) return null;
  const template = Deno.env.get('DTDC_TRACKING_URL_TEMPLATE')
    ?? 'https://www.dtdc.in/tracking/tracking_results.asp?Ttype=awb_no&strCnno={awb}&TrkType2=awb_no';
  return template.replace('{awb}', encodeURIComponent(code));
}

/* ── Errors ───────────────────────────────────────────────────────────────── */

/**
 * Bad credentials, a refused parcel and a down API are three different
 * problems with three different answers. `unserviceable` marks the refusal of
 * THIS parcel — the one the booking chain falls through on without logging a
 * fault, because a single carrier declining a route is an ordinary outcome.
 */
export class DtdcError extends Error {
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

function readError(body: unknown): { message: string; reason: string } {
  const e = (body as { error?: { message?: string; reason?: string; code?: string } } | null)?.error;
  const message = e?.message ?? (body as { message?: string } | null)?.message ?? '';
  return { message: String(message || 'Request rejected'), reason: String(e?.reason ?? e?.code ?? '') };
}

/* ── Transport ────────────────────────────────────────────────────────────── */

async function dtdcFetch(
  path: string,
  init: { method?: string; body?: unknown; accept?: string } = {},
): Promise<{ status: number; body: unknown; raw: Response }> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: init.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        Accept: init.accept ?? 'application/json',
        'api-key': apiKey(),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch (e) {
    // A network failure is not a refusal. The caller must be able to tell them
    // apart: one is worth falling back for, the other might mean the parcel was
    // created and we lost the answer.
    throw new DtdcError(503, `Could not reach DTDC: ${(e as Error).message}`);
  }

  if (res.status === 401 || res.status === 403) {
    throw new DtdcError(
      res.status,
      `DTDC rejected our credentials (${res.status}) — check DTDC_API_KEY against the API Playground in the customer portal`,
      await res.text().catch(() => null),
    );
  }
  if (res.status >= 500) {
    throw new DtdcError(502, `DTDC ${path} is failing (${res.status})`, await res.text().catch(() => null));
  }

  if (init.accept && init.accept !== 'application/json' && res.ok) {
    return { status: res.status, body: null, raw: res };
  }

  const text = await res.text();
  let body: unknown = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }

  if (res.status === 400 || res.status === 404 || res.status === 422) {
    const { message, reason } = readError(body);
    // Every 4xx here is "not this parcel": an unserviceable pincode, a field
    // they dislike, a service type not on the rate card. None of them is fixed
    // by retrying, all of them are fixed by another carrier.
    throw new DtdcError(res.status, `DTDC rejected the request: ${message}${reason ? ` (${reason})` : ''}`, body, true);
  }
  if (!res.ok) {
    throw new DtdcError(res.status, `DTDC ${path} answered ${res.status}`, body);
  }
  return { status: res.status, body, raw: res };
}

/* ── Booking ──────────────────────────────────────────────────────────────── */

/** Provider-neutral booking input. The booking function assembles this from our
 *  own rows and never sees a DTDC field name. */
export type BookingRequest = {
  /** Our order number — goes in `customer_reference_number`, so their portal
   *  and our console agree on what a parcel is. */
  reference: string;
  pickup: {
    name: string; phone: string; address: string;
    pincode: string; city: string | null; district: string | null; state: string | null;
  };
  drop: {
    name: string; phone: string; address: string;
    pincode: string; city: string | null; state: string | null;
  };
  description: string;
  declaredValue: number;
  weightKg: number;
  lengthCm: number | null;
  breadthCm: number | null;
  heightCm: number | null;
  sellerGstin: string | null;
};

export type BookingResult = {
  awb: string;
  trackingUrl: string | null;
  /** Which carrier Shipsy routed it to — "DTDC" for a normal consignment, but
   *  the platform can allocate to a partner on some lanes. Stored because the
   *  seller has to recognise whoever turns up. */
  courierPartner: string | null;
  courierAccount: string | null;
};

const num = (n: number | null, fallback: number) =>
  Number.isFinite(Number(n)) && Number(n) > 0 ? String(Number(n)) : String(fallback);

/**
 * Create a consignment — `single_pickup` manifestation, prepaid.
 *
 * Origin is the boutique, destination the buyer, and `return_details` the
 * boutique again: a failed delivery goes back to the shop it came from, not to
 * a warehouse this marketplace does not have.
 *
 * Throws DtdcError with `unserviceable: true` on a business rejection, which is
 * what the booking function falls through to the next carrier on.
 */
export async function createConsignment(req: BookingRequest): Promise<BookingResult> {
  const address = (a: BookingRequest['pickup'] | BookingRequest['drop']) => ({
    name: a.name,
    phone: a.phone,
    address_line_1: a.address,
    pincode: a.pincode,
    city: a.city ?? '',
    state: a.state ?? '',
    country: 'India',
    ...('district' in a && a.district ? { district: a.district } : {}),
  });

  const weight = num(req.weightKg, 0.5);
  const length = num(req.lengthCm, 30);
  const width = num(req.breadthCm, 20);
  const height = num(req.heightCm, 6);
  const declared = String(Math.max(1, Math.round(req.declaredValue)));

  const body: Record<string, unknown> = {
    customer_code: customerCode(),
    customer_reference_number: req.reference,
    service_type_id: serviceTypeId(),
    consignment_type: 'forward',
    movement_type: 'forward',
    action_type: 'single_pickup',
    load_type: 'NON-DOCUMENT',
    description: req.description.slice(0, 100),
    declared_value: declared,
    num_pieces: 1,
    weight_unit: 'kg',
    weight,
    dimension_unit: 'cm',
    length,
    width,
    height,
    // Every order is prepaid (0085). Cash was withdrawn platform-wide, and a
    // courier remitting collected cash to us would make the platform the
    // money handler. Zero, explicitly, rather than omitted.
    cod_amount: '0',
    is_risk_surcharge_applicable: false,
    origin_details: address(req.pickup),
    destination_details: address(req.drop),
    return_details: address(req.pickup),
    pieces_detail: [{
      description: req.description.slice(0, 100),
      declared_value: declared,
      weight,
      length,
      width,
      height,
      weight_unit: 'kg',
      dimension_unit: 'cm',
    }],
  };
  const hub = hubCode();
  if (hub) body.hub_code = hub;
  const commodity = commodityId();
  if (commodity) body.commodity_id = commodity;
  if (req.sellerGstin) body.tax_details = [{ sender_gstin: req.sellerGstin }];

  const { body: res } = await dtdcFetch('/api/customer/integration/consignment/upload/softdata/v2', {
    method: 'POST',
    body,
  });

  // Two reply shapes (see header). Normalise to one row.
  const top = (res ?? {}) as Record<string, unknown>;
  const row = (Array.isArray(top.data) ? (top.data[0] ?? {}) : top) as Record<string, unknown>;

  const ok = row.success === true || (row.success === undefined && typeof row.reference_number === 'string');
  const awb = String(row.reference_number ?? '').trim();
  if (!ok || !awb) {
    const why = String(row.message ?? row.reason ?? top.message ?? 'no reference number in the reply');
    throw new DtdcError(400, `DTDC did not create the consignment: ${why}`, res, true);
  }

  return {
    awb,
    trackingUrl: trackingUrlFor(awb),
    courierPartner: row.courier_partner ? String(row.courier_partner) : null,
    courierAccount: row.courier_account ? String(row.courier_account) : null,
  };
}

/* ── Label ────────────────────────────────────────────────────────────────── */

/** The 4x6 label as PDF bytes. Throws on anything but a PDF. */
export async function fetchLabelPdf(awb: string): Promise<Uint8Array> {
  const { raw } = await dtdcFetch(
    `/api/customer/integration/consignment/shippinglabel/stream?reference_number=${encodeURIComponent(awb)}`,
    { accept: 'application/pdf' },
  );
  const type = raw.headers.get('content-type') ?? '';
  const bytes = new Uint8Array(await raw.arrayBuffer());
  // A JSON error body arrives with a 200 on some Shipsy builds; a PDF starts
  // with %PDF. Check the bytes rather than trust the header alone.
  const isPdf = bytes.length > 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
  if (!isPdf) {
    throw new DtdcError(502, `DTDC label was not a PDF (${type || 'no content-type'})`, new TextDecoder().decode(bytes.slice(0, 300)));
  }
  return bytes;
}

/* ── Pickup scheduling ──────────────────────────────────────────────────────
 *
 * DTDC's customer pickup API. After a consignment exists (softdata upload), the
 * seller can ask DTDC to collect it on a chosen DATE and TIME SLOT from a
 * chosen ADDRESS — the "Schedule for Pickup" screen in the DTDC portal. This is
 * distinct from `action_type: single_pickup`, which raises an immediate pickup;
 * here the seller picks when. Returns a pickupId on success. */

export type PickupRequest = {
  /** YYYY-MM-DD, today or later. */
  date: string;
  /** HH:mm, the slot DTDC offered. */
  slotStart: string;
  slotEnd: string;
  /** The consignment to collect. */
  reference: string;
  pickup: {
    name: string; phone: string; address: string; address2?: string | null;
    pincode: string; city: string | null; state: string | null;
  };
  totalItems: number;
  totalWeightKg: number;
};

export type PickupResult = { pickupId: string | null; failureReason: string | null };

export async function schedulePickup(req: PickupRequest): Promise<PickupResult> {
  const { body } = await dtdcFetch('/api/customer/integration/pickup/create', {
    method: 'POST',
    body: {
      pickup_type: 'BUSINESS',
      customer_code: customerCode(),
      service_type_id: serviceTypeId(),
      load_type: 'NON-DOCUMENT',
      total_items: Math.max(1, Math.round(req.totalItems)),
      total_weight: Math.max(0.1, Number(req.totalWeightKg) || 0.5),
      pickup_slot: { start: req.slotStart, end: req.slotEnd, date: req.date },
      pickup_address: {
        name: req.pickup.name,
        phone: req.pickup.phone,
        address_line_1: req.pickup.address,
        address_line_2: req.pickup.address2 ?? '',
        pincode: req.pickup.pincode,
        city: req.pickup.city ?? '',
        state: req.pickup.state ?? '',
        country: 'India',
      },
      reference_number_list: [req.reference],
    },
  });
  const b = (body ?? {}) as { status?: string; data?: { pickupId?: string; failureReason?: string } };
  return { pickupId: b.data?.pickupId ? String(b.data.pickupId) : null, failureReason: b.data?.failureReason || null };
}

/* ── Cancel ───────────────────────────────────────────────────────────────── */

export type CancelResult = { cancelled: string[]; failed: { awb: string; message: string; reason: string }[] };

/** Cancel consignments that have not been picked up. Not wired to any UI yet —
 *  see DTDC_INTEGRATION_2026-11-14.md §"Not built". */
export async function cancelConsignments(awbs: string[]): Promise<CancelResult> {
  const { body } = await dtdcFetch('/api/customer/integration/consignment/cancel', {
    method: 'POST',
    body: { AWBNo: awbs, customerCode: customerCode() },
  });
  const b = (body ?? {}) as {
    success?: boolean;
    successConsignments?: { reference_number?: string; success?: boolean }[];
    failures?: { reference_number?: string; message?: string; reason?: string }[];
  };
  const failed = (b.failures ?? []).map((f) => ({
    awb: String(f.reference_number ?? ''), message: String(f.message ?? ''), reason: String(f.reason ?? ''),
  }));
  const failedSet = new Set(failed.map((f) => f.awb));
  // The documented success reply either lists successConsignments or is a bare
  // `{ status: 'OK' }` — in the latter case everything not in `failures` went.
  const cancelled = b.successConsignments
    ? b.successConsignments.filter((s) => s.success !== false).map((s) => String(s.reference_number ?? ''))
    : awbs.filter((a) => !failedSet.has(a));
  return { cancelled, failed };
}

/* ── Tracking ─────────────────────────────────────────────────────────────── */

export type TrackEvent = {
  type: string;
  occurredAt: string | null;
  location: string | null;
  text: string;
  failureReason: string | null;
};

export type TrackResult = {
  awb: string;
  status: string;
  events: TrackEvent[];
};

/**
 * One consignment's history. There is no bulk endpoint on the customer API, so
 * the reconcile sweep calls this once per in-flight parcel.
 */
export async function track(awb: string): Promise<TrackResult> {
  const { body } = await dtdcFetch(
    `/api/customer/integration/consignment/track?reference_number=${encodeURIComponent(awb)}`,
  );
  const b = (body ?? {}) as {
    reference_number?: string; status?: string;
    events?: { type?: string; event_time?: number | string; hub_name?: string; customer_update?: string; failure_reason?: string | null }[];
  };
  return {
    awb: String(b.reference_number ?? awb),
    status: String(b.status ?? ''),
    events: (b.events ?? []).map((e) => ({
      type: String(e.type ?? ''),
      occurredAt: toIso(e.event_time),
      location: e.hub_name ? String(e.hub_name) : null,
      text: String(e.customer_update ?? e.type ?? ''),
      failureReason: e.failure_reason ? String(e.failure_reason) : null,
    })),
  };
}

/* ── Time ─────────────────────────────────────────────────────────────────── */

/**
 * Epoch milliseconds (tracking), epoch seconds (webhook `*_epoch` fields) or an
 * ISO / "YYYY-MM-DD HH:mm:ss" string (webhook `event_time`) → ISO, or null
 * rather than an Invalid Date.
 */
export function toIso(when: number | string | null | undefined): string | null {
  if (when === null || when === undefined || when === '') return null;
  if (typeof when === 'number' || /^\d+$/.test(String(when))) {
    const n = Number(when);
    // Anything below 1e11 cannot be milliseconds for a date after 1973.
    const ms = n < 1e11 ? n * 1000 : n;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const s = String(when).trim();
  const d = new Date(s.includes('T') ? s : `${s.replace(' ', 'T')}Z`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/* ── Status vocabulary ────────────────────────────────────────────────────── */

/**
 * Shipsy consignment event `type` → our six stages, or null for an event that
 * means nothing for an ORDER.
 *
 * The 50 documented types are in the playground's "Consignment Status Webhook"
 * entry; the tracking endpoint uses the same vocabulary. Three rules:
 *
 *   1. Pre-pickup events (softdata_upload, pickup_scheduled, pickup_awaited,
 *      out_for_pickup) return null. Our timeline has no "booked" stage, and
 *      recording them as in_transit would show the buyer a parcel moving
 *      before anyone has collected it.
 *   2. Every RTO family member maps to `rto`, which apply_shipment_scan()
 *      turns into a delivery dispute so the sale never pays out.
 *   3. Anything unrecognised after pickup is `in_transit` — a status we have
 *      never seen must never be the thing that moves an order.
 */
export function mapEventStage(type: string): ScanStage | null {
  switch ((type ?? '').trim().toLowerCase()) {
    // ── booked, not yet collected ──
    // Recorded (migration 0116) so the seller and buyer see "Pickup requested"
    // / "Awaiting pickup" before collection, matching the courier's own page.
    // apply_shipment_scan() does not advance the order on this stage.
    case 'softdata_upload':
    case 'pickup_scheduled': case 'pickup_awaited':
    case 'out_for_pickup': case 'pickup_started': case 'out_for_store_pickup':
      return 'pickup_pending';
    // A softdata EDIT and a verification are not movements; cancelled / revoked
    // are administrative. Logged by the caller, never applied.
    case 'softdata_update': case 'consignment_verification':
    case 'cancelled': case 'revert_from_delivered': case 'revoke_rto':
      return null;

    case 'pickup_completed':
      return 'picked_up';
    case 'not_picked_up': case 'pickup_failed':
      return 'failed';

    // "accept" is documented as "when the consignment is out for delivery".
    case 'accept': case 'assigned_for_delivery': case 'startfordelivery':
    case 'reacheddestination':
      return 'out_for_delivery';

    case 'delivered': case 'delivery_pod':
      return 'delivered';

    // Attempted and parked. Our `failed` stage is deliberately inert in
    // apply_shipment_scan(): the buyer sees an attempt was made, no order
    // moves, no money releases.
    case 'attempted': case 'on_hold': case 'exception': case 'deps_exception':
    case 'delay_at_airport': case 'shelved': case 'returned_at_hub':
    case 'lost': case 'seized':
      return 'failed';

    case 'rto': case 'rto_initiated': case 'rto_in_transit': case 'rto_attempted':
    case 'rto_delivered': case 'rto_outfordelivery': case 'rto_inscan_at_hub':
      return 'rto';

    case 'inscan_at_hub': case 'outscan_at_hub': case 'intransittohub': case 'reachedathub':
    case 'handover_courier_partner': case 'added_to_bag': case 'bag_received':
    case 'vehicle_arrived': case 'assigned_to_hub': case 'release_on_hold': case 'reschedule':
    case 'customs_clearance_completed': case 'handed_in_customs_clearance':
    case 'assigntoworker': case 'picking_process_started': case 'unassignworker':
      return 'in_transit';

    default:
      return 'in_transit';
  }
}
