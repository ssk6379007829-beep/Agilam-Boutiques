/**
 * Shadowfax status callback — where "delivered" stops being the seller's word.
 *
 * All order writes go through apply_shipment_scan() (migration 0067), the same
 * narrow SECURITY DEFINER path the Shiprocket webhook uses. This function
 * decides nothing about an order: it authenticates, normalises, and forwards.
 * A second provider must not mean a second way to mark an order delivered.
 *
 * ── SECURITY: A SHARED SECRET, NOT A SIGNATURE ───────────────────────────────
 * Shadowfax sign nothing — no HMAC. (A signed "Webhooks" product is listed on
 * their developer site as "Coming soon"; it is not what ships today.) The
 * payload is not a fixed schema either: it is a per-client template built from
 * placeholder substitution.
 *
 * What they DO offer, from the SF360 portal's "Add New Webhook" form, is an
 * "Authorisation Present" setting with two choices — Basic Auth and Token — so
 * the callback can carry a real Authorization header. Register it as **Token**
 * with SHADOWFAX_WEBHOOK_SECRET.
 *
 * That is weaker than a signature (a shared secret proves possession, not that
 * the body is untampered) but much better than a secret in the query string,
 * which would sit in their logs, ours, and every proxy between. The query form
 * is still accepted as a last-resort fallback, so a misconfigured portal
 * setting degrades to "still authenticated" rather than to "every callback
 * rejected and every payout silently frozen".
 *
 * With no secret configured the function refuses every request. An empty
 * expected value would match an empty header and let anyone mark orders
 * delivered.
 *
 * ── RETRIES: THERE ARE NONE ─────────────────────────────────────────────────
 * Their docs: "a failed callback delivery is not retried. Use Tracking to
 * reconcile anything your endpoint missed." This is the opposite of Shiprocket,
 * which retries forever. Two consequences:
 *
 *   1. Respond fast and always 200 once authenticated — there is no second
 *      chance, so never reject a payload we could have partially used.
 *   2. A dropped callback is lost permanently, so `shadowfax-reconcile` is not
 *      an optimisation. Without it a missed `delivered` leaves an order short
 *      of delivered and its seller unpaid, silently and forever.
 *
 * Their docs also warn "the same event may be delivered more than once", which
 * 0067's unique index on (shipment_id, raw_status, occurred_at) plus
 * `on conflict do nothing` already absorbs.
 */

import { json, safeEqual, serviceClient } from '../_shared/courier.ts';
import { isoOrNull, mapStageFor, type ServiceLevel } from '../_shared/shadowfax.ts';

/**
 * The callback template we ask Shadowfax to configure, in their placeholder
 * names. Read defensively from several candidates anyway: the template is
 * agreed per client and a rename on their side must not silently stop
 * delivering orders — and "silently" is the operative word, because the visible
 * symptom is payouts quietly never releasing.
 */
type Callback = Record<string, unknown>;

function pick(row: Callback, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = row?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const secret = Deno.env.get('SHADOWFAX_WEBHOOK_SECRET') ?? '';
  if (!secret) {
    console.error('SHADOWFAX_WEBHOOK_SECRET is not set — refusing every callback');
    return json({ error: 'Webhook not configured' }, 503);
  }

  // The SF360 portal's "Add New Webhook" form offers an "Authorisation Present"
  // setting with two choices, Basic Auth and Token, so they DO send a real
  // Authorization header — better than the query parameter this used to rely
  // on. Register the webhook with "Token" and this secret.
  //
  // All four forms are accepted and compared in constant time:
  //   Authorization: Token <secret>   ← configure this one
  //   Authorization: Basic <base64>   ← if you pick Basic Auth instead
  //   x-api-key: <secret>
  //   ?key=<secret>                   ← last-resort fallback
  //
  // A header beats the query string because a URL secret sits in their logs,
  // our logs and any proxy in between. The fallbacks stay only so a misread
  // setting in their portal degrades to "still authenticated" rather than to
  // "every callback rejected and every payout frozen".
  const auth = req.headers.get('authorization') ?? '';
  const url = new URL(req.url);

  const candidates: string[] = [];
  if (/^Token\s+/i.test(auth)) candidates.push(auth.replace(/^Token\s+/i, '').trim());
  if (/^Bearer\s+/i.test(auth)) candidates.push(auth.replace(/^Bearer\s+/i, '').trim());
  if (/^Basic\s+/i.test(auth)) {
    try {
      // Basic is base64(user:pass); accept the secret as either half, since
      // which one it lands in depends on how the portal form is filled.
      const decoded = atob(auth.replace(/^Basic\s+/i, '').trim());
      const idx = decoded.indexOf(':');
      candidates.push(decoded.slice(idx + 1), decoded.slice(0, idx), decoded);
    } catch { /* not valid base64 — fall through to the other forms */ }
  }
  const headerKey = req.headers.get('x-api-key');
  if (headerKey) candidates.push(headerKey.trim());
  const queryKey = url.searchParams.get('key');
  if (queryKey) candidates.push(queryKey);

  if (!candidates.some((c) => safeEqual(c, secret))) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const rawBody = await req.text();
  let body: unknown;
  try {
    body = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    // Log the raw payload before giving up — their own best-practice note, and
    // the only forensic trail we get when a template changes shape.
    console.warn('shadowfax callback: unparseable body', rawBody.slice(0, 500));
    return json({ ok: true, note: 'Unparseable body ignored' });
  }
  if (!body) return json({ ok: true, note: 'Empty body ignored' });

  const rows: Callback[] = Array.isArray(body)
    ? body as Callback[]
    : Array.isArray((body as { data?: Callback[] }).data)
      ? (body as { data: Callback[] }).data
      : [body as Callback];

  const db = serviceClient();
  const results: { awb: string | null; stage?: string; applied: boolean; note?: string }[] = [];

  for (const row of rows) {
    // Hyperlocal has no AWB — the order id stands in, prefixed, exactly as the
    // booking function stored it.
    const awbField = pick(row, 'awb_number', 'awb', 'tracking_id');
    const sfxOrderId = pick(row, 'sfx_order_id', 'order_id');
    const awb = awbField ?? (sfxOrderId ? `SFXHL-${sfxOrderId}` : null);

    // `status_id` is the machine-readable code and the only thing worth
    // branching on; `status` is human prose that varies. Hyperlocal sends its
    // own vocabulary in `status`, so both are read.
    const statusId = pick(row, 'status_id', 'status');
    const statusText = pick(row, 'status', 'status_display') ?? statusId;

    if (!awb || !statusId) {
      results.push({ awb, applied: false, note: 'Missing identifier or status' });
      continue;
    }

    // Which vocabulary applies is a property of the shipment, not the payload.
    const { data: ship } = await db
      .from('shipments')
      .select('id, service_level')
      .eq('awb', awb)
      .maybeSingle();

    const serviceLevel = (ship?.service_level ?? 'surface') as ServiceLevel;
    const stage = mapStageFor(serviceLevel, statusId);

    const { data, error } = await db.rpc('apply_shipment_scan', {
      p_awb: awb,
      p_raw_status: statusText ?? statusId,
      p_stage: stage,
      p_location: pick(row, 'current_location', 'location'),
      p_occurred_at: isoOrNull(pick(row, 'last_updated', 'updated_time', 'created')),
      p_payload: row as Record<string, unknown>,
    });

    if (error) {
      // A database fault. There is no retry from them, so returning non-2xx
      // buys nothing — log loudly and let the sweep pick it up.
      console.error('apply_shipment_scan failed', { awb, stage, error: error.message });
      results.push({ awb, stage, applied: false, note: 'Database error — left for reconciliation' });
      continue;
    }

    if (data === false) {
      console.warn('callback for an unknown AWB', { awb, statusId });
      results.push({ awb, stage, applied: false, note: 'Unknown AWB' });
      continue;
    }

    /* ── Shipment metadata, not order state ─────────────────────────────── */
    // Deliberately outside apply_shipment_scan(): that function exists to
    // decide what a scan means for an ORDER, and a rider's phone number means
    // nothing for an order. It is written here because a rider is assigned
    // after booking, so the booking response cannot carry it.
    const patch: Record<string, unknown> = {};
    const riderName = pick(row, 'rider_name');
    const riderPhone = pick(row, 'rider_contact', 'rider_phone');
    if (riderName) patch.sfx_rider_name = riderName;
    if (riderPhone) patch.sfx_rider_phone = riderPhone;

    // What a return cost us. NOT deducted from anyone here: who bears it is an
    // admin's decision (0110's rto_bearer), because fault genuinely varies
    // between a wrong address and a refused parcel.
    if (stage === 'rto') {
      const rto = pick(row, 'rto_freight_charge', 'rto_charge');
      if (rto && Number.isFinite(Number(rto))) patch.rto_freight_charge = Number(rto);
    }

    if (Object.keys(patch).length > 0) {
      const { error: patchErr } = await db.from('shipments').update(patch).eq('awb', awb);
      // Never fatal. The scan is recorded and the order has already moved;
      // losing a rider's name must not fail a delivery we applied.
      if (patchErr) console.warn('shipment metadata patch failed', { awb, error: patchErr.message });
    }

    results.push({ awb, stage, applied: true });
  }

  return json({ ok: true, results });
});
