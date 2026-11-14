/**
 * DTDC consignment-status webhook — where "delivered" stops being the seller's
 * word.
 *
 * All order writes go through apply_shipment_scan() (migration 0067), the same
 * narrow SECURITY DEFINER path the Shiprocket and Shadowfax hooks use. This
 * function decides nothing about an order: it authenticates, normalises, and
 * forwards. A third provider must not mean a third way to mark an order
 * delivered.
 *
 * ── THE CONTRACT ────────────────────────────────────────────────────────────
 * Shipsy's "Consignment Status Webhook" (API Playground, auth X_API_KEY): one
 * JSON object per event, `type` naming one of ~50 event types, the consignment
 * in `reference_number`, our order number echoed in `customer_reference_number`,
 * and the time in `event_time` (ISO) and/or `event_time_epoch` (seconds). The
 * expected reply is `{ "statusCode": "200" }`.
 *
 * Registering it is NOT self-serve: the webhook URL and its `x-api-key` are
 * configured by DTDC/Shipsy on their side, on request. Until that is done this
 * endpoint receives nothing and `dtdc-reconcile` carries the whole load — so
 * the sweep, not this hook, is the system of record.
 *
 * ── SECURITY: A SHARED SECRET, NOT A SIGNATURE ──────────────────────────────
 * They sign nothing. The `x-api-key` header is compared in constant time
 * against DTDC_WEBHOOK_SECRET; `Authorization: Token/Bearer` and `?key=` are
 * accepted as fallbacks so a misread field on their form degrades to "still
 * authenticated" rather than "every callback rejected". With no secret
 * configured the function refuses every request: an empty expected value would
 * match an empty header and let anyone mark orders delivered.
 *
 * ── RETRIES ─────────────────────────────────────────────────────────────────
 * Unknown. Assume none: respond 200 once authenticated for anything we could
 * not use, and let the sweep catch what we missed. A database fault is the one
 * case worth a non-2xx — if they do retry, that is the retry we want.
 */

import { json, safeEqual, serviceClient } from '../_shared/courier.ts';
import { mapEventStage, toIso } from '../_shared/dtdc.ts';

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

  const secret = Deno.env.get('DTDC_WEBHOOK_SECRET') ?? '';
  if (!secret) {
    console.error('DTDC_WEBHOOK_SECRET is not set — refusing every callback');
    return json({ error: 'Webhook not configured' }, 503);
  }

  const auth = req.headers.get('authorization') ?? '';
  const url = new URL(req.url);
  const candidates: string[] = [];
  const headerKey = req.headers.get('x-api-key');
  if (headerKey) candidates.push(headerKey.trim());
  if (/^(Token|Bearer)\s+/i.test(auth)) candidates.push(auth.replace(/^(Token|Bearer)\s+/i, '').trim());
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
    console.warn('dtdc callback: unparseable body', rawBody.slice(0, 500));
    return json({ statusCode: '200', note: 'Unparseable body ignored' });
  }
  if (!body) return json({ statusCode: '200', note: 'Empty body ignored' });

  // One object per event is documented; accept a batch defensively.
  const rows: Callback[] = Array.isArray(body)
    ? body as Callback[]
    : Array.isArray((body as { data?: Callback[] }).data)
      ? (body as { data: Callback[] }).data
      : [body as Callback];

  const db = serviceClient();
  const results: { awb: string | null; type?: string; stage?: string | null; applied: boolean; note?: string }[] = [];

  for (const row of rows) {
    const awb = pick(row, 'reference_number', 'awb', 'awb_number');
    const type = pick(row, 'type', 'event', 'status');
    if (!awb || !type) {
      results.push({ awb, type: type ?? undefined, applied: false, note: 'Missing reference_number or type' });
      continue;
    }

    const stage = mapEventStage(type);
    if (stage === null) {
      // Pre-pickup or administrative. Not a movement, so not a scan. Logged
      // because `cancelled` on a parcel we think is live is worth a look.
      if (type.toLowerCase() === 'cancelled') console.warn('dtdc callback: consignment cancelled', { awb });
      results.push({ awb, type, stage: null, applied: false, note: 'Not an order-moving event' });
      continue;
    }

    const occurredAt = toIso(
      (row.event_time_epoch as number | string | undefined)
        ?? (row.event_time as string | undefined)
        ?? null,
    );
    const failure = pick(row, 'failure_reason');
    const text = pick(row, 'customer_update', 'event_description') ?? type;

    const { data, error } = await db.rpc('apply_shipment_scan', {
      p_awb: awb,
      p_raw_status: failure ? `${text} — ${failure}` : text,
      p_stage: stage,
      p_location: pick(row, 'carrier_location', 'hub_name', 'destination_city'),
      p_occurred_at: occurredAt,
      p_payload: row as Record<string, unknown>,
    });

    if (error) {
      // A database fault IS worth a retry, if they retry.
      console.error('apply_shipment_scan failed', { awb, stage, error: error.message });
      return json({ error: 'Could not record the scan' }, 500);
    }

    if (data === false) {
      // An AWB we never issued — someone else's consignment on the same
      // account, or a parcel booked from the DTDC portal by hand. Logged, not
      // failed: a non-2xx would not conjure the row.
      console.warn('dtdc callback for an unknown AWB', { awb, type });
      results.push({ awb, type, stage, applied: false, note: 'Unknown AWB' });
      continue;
    }

    results.push({ awb, type, stage, applied: true });
  }

  return json({ statusCode: '200', results });
});
