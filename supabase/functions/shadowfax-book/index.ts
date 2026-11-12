/**
 * Book one order with Shadowfax, and ship it.
 *
 * NOT THE ENTRY POINT. `book-parcel` is what the seller console calls; it tries
 * Shiprocket first and only reaches us when Shiprocket declines, passing
 * `skipFallback: true`. Shadowfax is the SECOND carrier, demoted on 2026-11-12
 * after a rural pincode came back unserviceable — their own site advertises
 * 16,681 of India's ~19,000 pincodes, and the gaps fall in exactly the villages
 * this marketplace needs. Shiprocket is an aggregator and routes across several
 * couriers per pincode, so it covers more.
 *
 * Shadowfax is kept rather than deleted because a second carrier still catches
 * orders Shiprocket declines, and every order it catches is one the seller does
 * not have to enter a docket number for by hand.
 *
 * Called with the seller's own session JWT when they tap "ship" on a packed
 * order. Booking is seller-triggered on purpose: a shop's dispatch window
 * (0078) can be days on made-to-measure work, and a courier sent the moment
 * payment cleared would arrive at a shop with nothing to hand over.
 *
 * Called directly (no `skipFallback`) it still falls back to Shiprocket itself,
 * so the old one-call behaviour keeps working.
 *
 * Surface is Forward Logistics with `order_type: marketplace` — collected from
 * an independent boutique, and returned to that boutique on failure rather than
 * to a warehouse we do not have.
 *
 * WHY NO SAME-DAY PATH HERE
 * Shadowfax's hyperlocal product routes on coordinates, and checkout has never
 * collected the buyer's. `_shared/shadowfax.ts` carries a working hyperlocal
 * client written against their documentation, but it is deliberately NOT wired
 * in: a dormant branch in a function that spends money is a branch that goes
 * live one day without anyone testing it. See §2 and §6 of
 * SHADOWFAX_INTEGRATION_2026-11-12.md for the two blockers.
 *
 * WHAT THIS REFUSES
 *   • COD orders. Cash was withdrawn in 0085, but pre-0085 rows are real, and a
 *     courier remitting their cash to us would make the platform the money
 *     handler. Refused here AND by trg_shipments_reject_cod (0110) — the UI is
 *     not the boundary (CLAUDE.md rule 7).
 *   • Orders already shipped. Shadowfax deduplicates on client_order_id, but
 *     our own double-write would still produce two shipment rows.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { CORS, json, serviceClient } from '../_shared/courier.ts';
import { SfxError, bookForward, forwardServiceable, type BookingRequest } from '../_shared/shadowfax.ts';

type OrderRow = {
  id: string; order_number: string; boutique_id: string; status: string;
  total: number; payment_method: string | null; created_at: string;
  guest_name: string | null; guest_phone: string | null; guest_city: string | null;
  guest_address: string | null; guest_pincode: string | null;
};

/**
 * Hand the order to Shiprocket instead.
 *
 * Called over HTTP rather than by importing its logic: `shiprocket-book` is a
 * separate booking path that authenticates the seller itself. Forwarding the
 * caller's own JWT means it performs exactly the ownership checks it always
 * has — this function gains no authority it did not already have, and that
 * function is not modified at all.
 */
async function fallbackToShiprocket(orderId: string, authHeader: string, why: string): Promise<Response> {
  const base = Deno.env.get('SUPABASE_URL') ?? '';
  console.log('shadowfax-book falling back to shiprocket', { orderId, why });

  try {
    const res = await fetch(`${base}/functions/v1/shiprocket-book`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
        apikey: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      },
      body: JSON.stringify({ orderId }),
    });
    const body = await res.json().catch(() => null);

    if (res.ok && body?.ok) {
      // Say which carrier actually took it. The seller does not choose, but
      // they do have to recognise whoever turns up at their door.
      return json({ ...body, provider: 'shiprocket', fellBack: true, fallbackReason: why });
    }

    // Both providers declined. The seller's next step is the manual form, so
    // say so plainly rather than stacking two API errors.
    return json({
      error: `Shadowfax cannot carry this parcel (${why}), and Shiprocket also declined: ` +
        `${body?.error ?? `HTTP ${res.status}`}. Ship it with your own courier and enter the docket number.`,
      canShipManually: true,
    }, 409);
  } catch (e) {
    return json({
      error: `Shadowfax cannot carry this parcel (${why}), and the Shiprocket fallback could not be reached: ` +
        `${(e as Error).message}. Ship it with your own courier and enter the docket number.`,
      canShipManually: true,
    }, 502);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { orderId, skipFallback } = await req.json().catch(() => ({ orderId: null, skipFallback: false }));
    if (!orderId) return json({ error: 'orderId is required' }, 400);

    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Not signed in' }, 401);

    // `book-parcel` orchestrates the carrier order and has already tried
    // Shiprocket before calling us, so it sets skipFallback to stop us calling
    // it straight back — a loop that would book the same parcel twice.
    const declineOrFallback = (why: string) =>
      skipFallback
        ? json({ declined: true, reason: why }, 409)
        : fallbackToShiprocket(orderId as string, authHeader, why);

    // The JWT is verified by Supabase, not by us parsing it. A user-scoped
    // client is also what calls order_parcel_metrics below: that RPC checks
    // ownership through auth.uid(), which is null under the service role.
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
    );
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: 'Not signed in' }, 401);

    const db = serviceClient();

    /* ── The order ──────────────────────────────────────────────────────── */
    const { data: order, error: orderErr } = await db
      .from('orders')
      .select('id, order_number, boutique_id, status, total, payment_method, created_at, guest_name, guest_phone, guest_city, guest_address, guest_pincode')
      .eq('id', orderId)
      .maybeSingle<OrderRow>();
    if (orderErr || !order) return json({ error: 'Order not found' }, 404);

    if (order.payment_method === 'COD') {
      return json({
        error: 'Cash-on-delivery orders cannot be booked on a platform courier account. Ship this one with your own courier and enter the docket number.',
        canShipManually: true,
      }, 409);
    }
    if (order.status === 'shipped' || order.status === 'delivered') {
      return json({ error: 'This order has already been shipped' }, 409);
    }
    if (order.status === 'cancelled' || order.status === 'rejected') {
      return json({ error: 'This order is closed' }, 409);
    }

    const { data: existing } = await db
      .from('shipments').select('id').eq('order_id', order.id).maybeSingle();
    if (existing) return json({ error: 'This order already has a parcel recorded' }, 409);

    /* ── The shop, and that it belongs to the caller ────────────────────── */
    // `boutiques` cannot be read with select('*') — column grants since 0021.
    // gst_number is readable here only because this runs as the service role.
    const { data: shop } = await db
      .from('boutiques')
      .select('id, name, owner_id, phone, address_line, city, state, pincode, gst_number, shadowfax_enabled')
      .eq('id', order.boutique_id)
      .maybeSingle();
    if (!shop) return json({ error: 'Boutique not found' }, 404);
    if (shop.owner_id !== user.id) return json({ error: 'Not your order' }, 403);

    // Both switches. Checked AFTER ownership so an unauthorised caller learns
    // nothing about our rollout state.
    const { data: settings } = await db
      .from('platform_settings').select('shadowfax_enabled').eq('id', 1).maybeSingle();

    if (!settings?.shadowfax_enabled || !shop.shadowfax_enabled) {
      // Not an error — Shadowfax simply is not on for this shop yet, and the
      // order still has to ship. Straight down the chain.
      return await declineOrFallback('Shadowfax is not enabled for this shop');
    }

    const pickupPin = (shop.pincode ?? '').replace(/\D/g, '');
    if (pickupPin.length !== 6) {
      return await declineOrFallback('the shop has no valid pickup pincode');
    }

    /* ── Where it is going ──────────────────────────────────────────────── */
    // A signed-in buyer's address still lands on the guest_* columns at
    // checkout, so this reads the same fields either way.
    const dropPin = (order.guest_pincode ?? '').replace(/\D/g, '');
    const address = (order.guest_address ?? '').trim();
    if (dropPin.length !== 6 || !address) {
      return json({ error: 'This order has no delivery address or pincode — it cannot be booked.' }, 422);
    }

    const { data: items } = await db
      .from('order_items').select('title, price, qty, product_id').eq('order_id', order.id);
    if (!items?.length) return json({ error: 'This order has no items' }, 422);

    /* ── The parcel ─────────────────────────────────────────────────────── */
    // Migration 0065. Product weights with a per-shop fallback, resolved in one
    // place so this function does not reimplement the fallback chain.
    const { data: metrics, error: metricsErr } = await userClient
      .rpc('order_parcel_metrics', { p_order_id: order.id })
      .maybeSingle<{ weight_kg: number; is_estimated: boolean }>();
    if (metricsErr || !metrics) {
      return json({ error: metricsErr?.message ?? 'Could not work out the parcel weight' }, 422);
    }

    /* ── The destination state ──────────────────────────────────────────── */
    // Their customer_details wants a state and checkout never collected one.
    // It comes from the same lazily-filled `pincodes` directory (0077a) that
    // priced this delivery, so the address we book cannot disagree with the
    // address we charged for. A pincode missing from the cache sends an empty
    // state, which Shadowfax answers with its own clear rejection — better than
    // us inventing one.
    const { data: pin } = await db
      .from('pincodes').select('state').eq('pincode', dropPin).maybeSingle();

    const bookingReq: BookingRequest = {
      reference: order.order_number,
      pickup: {
        name: shop.name,
        phone: (shop.phone ?? '').replace(/\D/g, '').slice(-10),
        address: (shop.address_line ?? '').trim(),
        pincode: pickupPin,
        city: shop.city,
        state: shop.state,
        lat: null,
        lng: null,
      },
      drop: {
        name: (order.guest_name ?? '').trim() || 'Customer',
        phone: (order.guest_phone ?? '').replace(/\D/g, '').slice(-10),
        address,
        pincode: dropPin,
        city: (order.guest_city ?? '').trim() || null,
        state: (pin as { state?: string } | null)?.state ?? null,
        lat: null,
        lng: null,
      },
      items: items.map((it, i) => ({
        id: it.product_id ?? `item-${i}`,
        name: it.title,
        price: Number(it.price),
        qty: Number(it.qty),
      })),
      declaredValue: Number(order.total),
      weightGrams: Math.max(1, Math.round(Number(metrics.weight_kg) * 1000)),
      // Only matters at or above ₹50,000, where an e-way bill is mandatory and
      // at least one SKU must carry the seller's GSTIN.
      sellerGstin: (shop.gst_number ?? '').trim() || null,
    };

    /* ── Will they carry it? ────────────────────────────────────────────── */
    // Asked before creating anything, so we never make a parcel we then have to
    // cancel. An unserviceable route is an ORDINARY outcome for a single
    // carrier, not an error — this marketplace ships out of Tamil Nadu tier-2
    // and tier-3 towns.
    // ADVISORY, NOT GATING. Order creation checks serviceability itself and
    // answers `message: Failure` on an unserviceable pincode, so this call only
    // ever saves us a doomed booking — it is not what makes the decision.
    //
    // That distinction is load-bearing. Against a real staging token this
    // endpoint answers `400 Invalid Request` for every documented `service`
    // value ("marketplace", "regular", "fwd", …), and their own docs say the
    // supported list comes from an account manager. Treating a failed CHECK as
    // a failed ROUTE would send every parcel to Shiprocket and Shadowfax would
    // never carry a single one — the integration would look wired up and be
    // entirely dead. So an error here means "ask the real way" and we book.
    //
    // A definite `false` is still honoured: that is a real answer.
    try {
      const serviceable = await forwardServiceable(pickupPin, dropPin);
      if (!serviceable) {
        return await declineOrFallback(`Shadowfax does not serve ${pickupPin} → ${dropPin}`);
      }
    } catch (e) {
      console.warn('shadowfax serviceability check unavailable, booking anyway', (e as Error).message);
    }

    /* ── Book it ────────────────────────────────────────────────────────── */
    let booking;
    try {
      booking = await bookForward(bookingReq);
    } catch (e) {
      // A business rejection — unserviceable, a field they dislike, anything
      // they refuse — is a fallback, not an error shown to the seller. Note
      // these arrive as HTTP 200 with message "Failure"; the adapter is what
      // turns that into a throw.
      if (e instanceof SfxError && e.unserviceable) {
        return await declineOrFallback(e.message);
      }
      throw e;
    }

    /* ── Record it, then ship it ────────────────────────────────────────── */
    // This order is not arbitrary: 0063's trg_orders_require_shipment refuses
    // the 'shipped' transition until the shipment row exists.
    const { error: shipErr } = await db.from('shipments').insert({
      order_id: order.id,
      boutique_id: order.boutique_id,
      courier_id: null,
      courier_name: 'Shadowfax',
      awb: booking.awb,
      tracking_url: booking.trackingUrl,
      provider: 'shadowfax',
      service_level: 'surface',
      sfx_order_id: booking.sfxOrderId,
      // Forward Logistics quotes no freight at creation — the cost lands at
      // invoicing, which is why 0110's margin view tolerates a null `we_paid`.
      freight_charge: null,
      declared_weight_kg: metrics.weight_kg,
      created_by: user.id,
    });
    if (shipErr) {
      // Booked with Shadowfax but unknown to us. Their idempotency means a
      // retry returns the SAME parcel rather than creating a second one, so
      // this is recoverable — but it still wants a human to confirm.
      console.error('shipment insert failed after booking', { awb: booking.awb, error: shipErr.message });
      return json({
        error: `The parcel was booked (AWB ${booking.awb}) but could not be saved. Send this AWB to support before retrying.`,
      }, 500);
    }

    const { error: statusErr } = await db
      .from('orders').update({ status: 'shipped' }).eq('id', order.id);
    if (statusErr) {
      return json({
        error: `Parcel booked (AWB ${booking.awb}) but the order status did not update: ${statusErr.message}`,
      }, 500);
    }

    return json({
      ok: true,
      provider: 'shadowfax',
      serviceLevel: 'surface',
      awb: booking.awb,
      courierName: 'Shadowfax',
      labelUrl: null,
      freightCharge: null,
      promisedDeliveryDate: booking.promisedDeliveryDate,
      weightKg: metrics.weight_kg,
      // The seller carries any weight-discrepancy charge, so they are told when
      // we declared a guess rather than a measured weight.
      weightEstimated: metrics.is_estimated,
    });
  } catch (e) {
    if (e instanceof SfxError) {
      console.error('shadowfax-book SfxError', e.status, e.message, e.body);
      return json({ error: e.message }, e.status >= 500 ? 502 : e.status);
    }
    console.error('shadowfax-book failed', e);
    return json({ error: e instanceof Error ? e.message : 'Booking failed' }, 500);
  }
});
