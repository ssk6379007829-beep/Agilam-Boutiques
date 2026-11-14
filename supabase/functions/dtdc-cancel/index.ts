/**
 * Call off a DTDC pickup the seller booked but the courier has NOT yet collected.
 *
 * The seller's own "undo" for a booking: wrong slot, wrong day, or they would
 * rather hand the parcel to another courier. Reverses the booking end to end —
 *
 *   1. Ownership and state checks — the caller's JWT must own the shop, and the
 *      shipment must be a DTDC parcel with no courier scan on it yet. Once DTDC
 *      has scanned it (anything past `pickup_pending`), it is physically in
 *      their hands: this refuses, and the seller cancels through DTDC support.
 *   2. The consignment is cancelled at DTDC. If DTDC refuses, we stop here and
 *      surface why — the booking still stands, so we must not wipe our record of
 *      it.
 *   3. The order is dropped back to 'accepted' (and shipped_at cleared), THEN
 *      the shipment row is deleted. Order matters: 0063's
 *      trg_orders_require_shipment only guards the forward transition, so
 *      reverting first is clean, and deleting the shipment while the order is
 *      'accepted' trips nothing. shipment_events cascade off the shipment.
 *
 * After this the ship bar returns on the order and the seller can re-book — a
 * different slot, day, or courier.
 *
 * Deployed by hand (Edge Functions do not deploy on commit). Needs
 * _shared/courier.ts and _shared/dtdc.ts alongside it.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { CORS, json, serviceClient } from '../_shared/courier.ts';
import { DtdcError, cancelConsignments } from '../_shared/dtdc.ts';

type ShipmentRow = {
  id: string;
  order_id: string;
  boutique_id: string;
  awb: string;
  provider: string | null;
  last_status: string | null;
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { orderId } = await req.json().catch(() => ({ orderId: null }));
    if (!orderId) return json({ error: 'orderId is required' }, 400);

    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Not signed in' }, 401);

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
    );
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: 'Not signed in' }, 401);

    const db = serviceClient();

    const { data: shipment, error: shipErr } = await db
      .from('shipments')
      .select('id, order_id, boutique_id, awb, provider, last_status')
      .eq('order_id', orderId)
      .maybeSingle<ShipmentRow>();
    if (shipErr) return json({ error: shipErr.message }, 500);
    if (!shipment) return json({ error: 'This order has no parcel to cancel' }, 404);

    // Ownership: the shop must belong to the caller. `boutiques` has
    // column-level grants, so name the columns.
    const { data: shop } = await db
      .from('boutiques')
      .select('id, owner_id')
      .eq('id', shipment.boutique_id)
      .maybeSingle<{ id: string; owner_id: string }>();
    if (!shop) return json({ error: 'Boutique not found' }, 404);
    if (shop.owner_id !== user.id) return json({ error: 'Not your order' }, 403);

    if (shipment.provider !== 'dtdc') {
      return json({
        error: 'Only a DTDC pickup can be cancelled here. For another courier, cancel it with them and update this order.',
      }, 409);
    }

    // A parcel the courier has already scanned is in their hands — a button
    // cannot recall it. `last_status` is null until the first scan and
    // 'pickup_pending' while the pickup is still only requested; anything beyond
    // that means it has moved.
    if (shipment.last_status && shipment.last_status !== 'pickup_pending') {
      return json({
        error: 'This parcel has already been picked up by the courier, so it can no longer be cancelled here. Contact DTDC to recall it.',
      }, 409);
    }

    // Cancel at DTDC first. If it refuses, the booking still stands — leave our
    // record of it intact and tell the seller why.
    let result;
    try {
      result = await cancelConsignments([shipment.awb]);
    } catch (e) {
      if (e instanceof DtdcError) {
        console.error('dtdc-cancel DtdcError', e.status, e.message, e.body);
        return json({ error: `DTDC would not cancel this consignment: ${e.message}` }, 502);
      }
      throw e;
    }

    if (!result.cancelled.includes(shipment.awb)) {
      const why = result.failed.find((f) => f.awb === shipment.awb);
      const reason = why ? `${why.message}${why.reason ? ` (${why.reason})` : ''}` : 'DTDC did not confirm the cancellation';
      // A consignment DTDC says is ALREADY cancelled is a success for us — the
      // booking is gone either way, so fall through and clean up our side.
      if (!/already|cancel/i.test(reason)) {
        return json({ error: `DTDC would not cancel this consignment: ${reason}` }, 409);
      }
      console.warn('dtdc-cancel treating as cancelled', { awb: shipment.awb, reason });
    }

    // Revert the order BEFORE deleting the shipment (the require-shipment guard
    // only fires on the forward transition, so this order is safe). Clearing
    // shipped_at lets a fresh booking stamp its own.
    const { error: revErr } = await db
      .from('orders')
      .update({ status: 'accepted', shipped_at: null })
      .eq('id', shipment.order_id);
    if (revErr) {
      // The consignment is cancelled at DTDC but our order is stuck 'shipped'.
      // Surface loudly rather than silently — support can fix the row, and the
      // seller must NOT be told it worked when the order still reads shipped.
      console.error('dtdc-cancel: order revert failed after DTDC cancel', { orderId, error: revErr.message });
      return json({
        error: `The DTDC booking was cancelled, but this order could not be reset: ${revErr.message}. Send the order number to support.`,
      }, 500);
    }

    // Delete the shipment (its scan events cascade off it).
    const { error: delErr } = await db.from('shipments').delete().eq('id', shipment.id);
    if (delErr) {
      console.error('dtdc-cancel: shipment delete failed after revert', { orderId, error: delErr.message });
      return json({
        error: `The pickup was cancelled and the order reset, but the old parcel record could not be removed: ${delErr.message}. Send the order number to support.`,
      }, 500);
    }

    return json({ ok: true, orderId: shipment.order_id, awb: shipment.awb });
  } catch (e) {
    if (e instanceof DtdcError) {
      console.error('dtdc-cancel DtdcError', e.status, e.message, e.body);
      return json({ error: e.message }, 502);
    }
    console.error('dtdc-cancel failed', e);
    return json({ error: e instanceof Error ? e.message : 'Cancellation failed' }, 500);
  }
});
