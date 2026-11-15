/**
 * Book one order with whichever carrier will take it.
 *
 * THE ONE ENTRY POINT the seller console calls. Named for what it does rather
 * than for a carrier, because which carrier carries a parcel is our problem,
 * not the seller's — they tap "ship" and something turns up at their door.
 *
 * THE CHAIN
 *
 *   DTDC  →  Shiprocket  →  Shadowfax  →  the seller types a docket number
 *
 * WHY DTDC FIRST (2026-11-14)
 * DTDC is the platform's contracted primary carrier: one account (GL24686),
 * one rate card, one monthly invoice, and a pickup from the boutique's own
 * address on every booking. It goes first because that is the commercial
 * arrangement, not because it covers more — it is a single carrier and will
 * decline some rural lanes, which is exactly why the rest of the chain stays.
 *
 * WHY SHIPROCKET SECOND (changed 2026-11-12)
 * Shadowfax led until a rural pincode came back unserviceable. That is not a
 * Shadowfax defect, it is what every SINGLE carrier looks like — their own site
 * advertises 16,681 of India's ~19,000 pincodes, and the missing ones are
 * disproportionately rural, which is exactly where this marketplace's buyers
 * are. Shiprocket is an AGGREGATOR: it picks among several couriers per
 * pincode, so its coverage is the union of theirs rather than any one carrier's.
 * Swapping one single carrier for another would only have moved which villages
 * failed.
 *
 * Shadowfax stays as the third rung because a further carrier still catches
 * orders the others decline, and each one it catches is an order the seller
 * does not have to enter a docket number for by hand.
 *
 * HOW IT CALLS THEM
 * Over HTTP, forwarding the seller's own JWT, rather than importing their
 * logic. Every booking function authenticates the caller itself and checks
 * that the order belongs to them, so this orchestrator gains no authority of
 * its own — it decides order, nothing else. `shiprocket-book` in particular is
 * not modified at all.
 *
 * WHY NOT ORCHESTRATE IN THE BROWSER
 * Each individual booking is atomic server-side, so a browser could in
 * principle do this. But a seller who navigates away between the two calls
 * would leave an order that is paid, packed and unshipped, with no record of
 * why. The chain belongs where it cannot be interrupted.
 */

import { CORS, json } from '../_shared/courier.ts';

type Attempt = { carrier: string; reason: string };

/** Call one booking function with the seller's own credentials. */
async function tryCarrier(
  fn: string,
  orderId: string,
  authHeader: string,
  body: Record<string, unknown> = {},
): Promise<{ ok: boolean; body: Record<string, unknown> | null; status: number }> {
  const base = Deno.env.get('SUPABASE_URL') ?? '';
  try {
    const res = await fetch(`${base}/functions/v1/${fn}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
        apikey: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      },
      body: JSON.stringify({ orderId, ...body }),
    });
    const parsed = await res.json().catch(() => null);
    return { ok: res.ok && Boolean(parsed?.ok), body: parsed, status: res.status };
  } catch (e) {
    // A carrier we could not reach is a carrier that declined, for our
    // purposes — but it is logged differently, because an outage is temporary
    // and a coverage gap is not.
    console.error(`book-parcel: ${fn} unreachable`, (e as Error).message);
    return { ok: false, body: { error: `${fn} unreachable: ${(e as Error).message}` }, status: 503 };
  }
}

/**
 * Should we stop the chain rather than try the next carrier?
 *
 * Some refusals are about the ORDER, not the carrier — already shipped, not
 * yours, no address, a legacy cash order. Trying a second carrier cannot fix
 * any of those, and on "already shipped" it risks a second real parcel against
 * one sale. Only a carrier-specific refusal should advance the chain.
 */
function isTerminal(status: number, body: Record<string, unknown> | null): boolean {
  // Auth and ownership failures: the next carrier would refuse identically.
  if (status === 401 || status === 403 || status === 404) return true;
  // The carrier DID book a parcel and then failed to record it. The order is
  // shipped whether or not our tables say so, and the next carrier would
  // happily book a second one against the same sale. Carriers flag this
  // explicitly; the text match is a fallback for an older deployed copy that
  // predates the flag (Edge Functions deploy by hand, so both can be live).
  if (body?.booked === true) return true;
  const err = String(body?.error ?? '').toLowerCase();
  if (err.includes('awb') && err.includes('booked')) return true;
  // A COD order, a closed order, or one already carrying a parcel.
  return err.includes('already') || err.includes('closed') || err.includes('cash-on-delivery');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const { orderId, carrier, date, slotStart, slotEnd, courierId } = await req.json().catch(() => ({ orderId: null }));
  if (!orderId) return json({ error: 'orderId is required' }, 400);

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'Not signed in' }, 401);

  // The pickup slot the seller chose in the ship sheet, forwarded to the carrier
  // (DTDC schedules the collection for it).
  const pickup = (date && slotStart && slotEnd) ? { date, slotStart, slotEnd } : {};

  /* ── Seller chose a carrier: honour it, no auto-fallback ─────────────────── */
  // "Seller picks the courier" (2026-11-14). When the ship sheet names a
  // carrier we book that one and surface its refusal, rather than quietly
  // trying another — the seller decided, and switching couriers under them
  // would be a surprise.
  if (carrier) {
    const fn = carrier === 'dtdc' ? 'dtdc-book'
      : carrier === 'shiprocket' ? 'shiprocket-book'
      : carrier === 'shadowfax' ? 'shadowfax-book' : null;
    if (!fn) return json({ error: `Unknown courier: ${carrier}` }, 400);
    // A Shiprocket courier_company_id the seller picked in the ship sheet is
    // forwarded so shiprocket-book assigns that exact courier.
    const extra = carrier === 'shiprocket' && courierId ? { courierId } : {};
    const r = await tryCarrier(fn, orderId, authHeader, { ...pickup, ...extra, skipFallback: true });
    if (r.ok) return json({ ...r.body, provider: carrier });
    if (r.body?.booked === true) return json(r.body, r.status);
    if (r.status === 401 || r.status === 403 || r.status === 404) {
      return json(r.body ?? { error: 'Could not book this parcel' }, r.status);
    }
    const reason = String(r.body?.reason ?? r.body?.error ?? `HTTP ${r.status}`);
    return json({
      error: `${carrier.toUpperCase()} could not book this parcel: ${reason}. Ship it with your own courier and enter the docket number.`,
      canShipManually: true,
    }, 409);
  }

  const attempts: Attempt[] = [];

  /* ── 1. DTDC, the contracted carrier ────────────────────────────────────── */
  // Declines arrive as `{ declined: true, reason }` 409 — not enabled for the
  // shop, an unserviceable lane, a rejected field. A configuration or transport
  // fault arrives as `{ error }` instead; both advance the chain, but the
  // function logs the second kind as a fault so it gets found.
  const dt = await tryCarrier('dtdc-book', orderId, authHeader, pickup);
  if (dt.ok) {
    return json({ ...dt.body, provider: 'dtdc', attempts });
  }
  if (isTerminal(dt.status, dt.body)) {
    // Nothing about the next carrier would change this answer.
    return json(dt.body ?? { error: 'Could not book this parcel' }, dt.status);
  }
  attempts.push({ carrier: 'dtdc', reason: String(dt.body?.reason ?? dt.body?.error ?? `HTTP ${dt.status}`) });

  /* ── 2. Shiprocket, the aggregator ──────────────────────────────────────── */
  const sr = await tryCarrier('shiprocket-book', orderId, authHeader);
  if (sr.ok) {
    return json({
      ...sr.body,
      provider: 'shiprocket',
      // Only a fallback when something declined before it. The seller is told
      // which courier is coming, not which one said no.
      fellBack: attempts.length > 0,
      fallbackReason: attempts[0]?.reason,
      attempts,
    });
  }
  if (isTerminal(sr.status, sr.body)) {
    return json(sr.body ?? { error: 'Could not book this parcel' }, sr.status);
  }
  attempts.push({ carrier: 'shiprocket', reason: String(sr.body?.error ?? `HTTP ${sr.status}`) });

  /* ── 3. Shadowfax ───────────────────────────────────────────────────────── */
  // skipFallback stops it calling shiprocket-book straight back, which would
  // retry a carrier that has already declined and could book twice.
  const sfx = await tryCarrier('shadowfax-book', orderId, authHeader, { skipFallback: true });
  if (sfx.ok) {
    return json({
      ...sfx.body,
      provider: 'shadowfax',
      fellBack: true,
      fallbackReason: attempts[0]?.reason,
      attempts,
    });
  }
  // Shadowfax is the LAST carrier before the manual docket form. Only a parcel
  // it actually booked and then failed to record (`booked: true`) should stop
  // the chain here. Everything else — a decline, an error, or a 404 because
  // shadowfax-book is not deployed — must fall through to the clean manual
  // message below, NOT surface a raw function-not-found 404 that the seller
  // console can only render as "Edge Function returned a non-2xx status code".
  if (sfx.body?.booked === true) {
    return json(sfx.body, sfx.status);
  }
  attempts.push({
    carrier: 'shadowfax',
    reason: String(sfx.body?.reason ?? sfx.body?.error ?? `HTTP ${sfx.status}`),
  });

  /* ── 4. Nobody will carry it ────────────────────────────────────────────── */
  // The seller's next step is the manual docket form, so say that plainly
  // instead of stacking two carriers' error messages and leaving them to guess.
  console.warn('book-parcel: no carrier accepted', { orderId, attempts });
  return json({
    error: 'No courier could pick this parcel up automatically. Ship it with your own courier and enter the docket number.',
    canShipManually: true,
    attempts,
  }, 409);
});
