/**
 * Book one order with DTDC, and ship it.
 *
 * NOT THE ENTRY POINT. `book-parcel` is what the seller console calls; DTDC is
 * the FIRST rung of its chain (2026-11-14), ahead of Shiprocket and Shadowfax,
 * because DTDC is the platform's contracted primary carrier — one account, one
 * rate card, one invoice. The chain still exists: a pincode DTDC refuses falls
 * through to the aggregator rather than onto the seller's manual docket form.
 *
 * Called with the seller's own session JWT when they tap "ship" on a packed
 * order. Booking is seller-triggered on purpose: a shop's dispatch window
 * (0078) can be days on made-to-measure work, and a courier sent the moment
 * payment cleared would arrive at a shop with nothing to hand over.
 *
 * WHAT HAPPENS
 *   1. Ownership and state checks — identical to the other carriers.
 *   2. Softdata upload (`single_pickup`): DTDC assigns the AWB and raises the
 *      pickup from the boutique's address. The address is inline on every
 *      consignment, so unlike Shiprocket there is no pickup location to
 *      register first.
 *   3. The label PDF is fetched and stored in the private `shipping-labels`
 *      bucket at <boutique_id>/<awb>.pdf; the seller console signs a URL on
 *      demand. The label carries the buyer's address and phone, so it is never
 *      a public object.
 *   4. The shipment row is written, then the order flips to 'shipped'. This
 *      order is not arbitrary: 0063's trg_orders_require_shipment refuses the
 *      transition until the row exists.
 *
 * WHAT THIS REFUSES
 *   • COD orders. Cash was withdrawn in 0085, but pre-0085 rows are real, and a
 *     courier remitting cash to us would make the platform the money handler.
 *     Refused here AND by trg_shipments_reject_cod (0110) — the UI is not the
 *     boundary (CLAUDE.md rule 7).
 *   • Orders already shipped — our own double-write would produce two rows.
 *
 * A refusal of THIS parcel comes back as `{ declined: true, reason }` 409 so
 * the orchestrator moves on. This function never calls another carrier itself;
 * the chain lives in one place.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { CORS, json, serviceClient } from '../_shared/courier.ts';
import { DtdcError, createConsignment, fetchLabelPdf, schedulePickup, type BookingRequest } from '../_shared/dtdc.ts';

type OrderRow = {
  id: string; order_number: string; boutique_id: string; status: string;
  total: number; payment_method: string | null; created_at: string;
  guest_name: string | null; guest_phone: string | null; guest_city: string | null;
  guest_address: string | null; guest_pincode: string | null;
};

const LABEL_BUCKET = 'shipping-labels';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { orderId, date, slotStart, slotEnd } = await req.json().catch(() => ({ orderId: null }));
    if (!orderId) return json({ error: 'orderId is required' }, 400);

    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Not signed in' }, 401);

    // A refusal of THIS parcel, not an error. book-parcel reads `declined` and
    // tries the next carrier.
    const decline = (why: string) => json({ declined: true, reason: why }, 409);

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
      .select('id, name, owner_id, phone, address_line, city, district, state, pincode, gst_number, dtdc_enabled')
      .eq('id', order.boutique_id)
      .maybeSingle();
    if (!shop) return json({ error: 'Boutique not found' }, 404);
    if (shop.owner_id !== user.id) return json({ error: 'Not your order' }, 403);

    // Both switches. Checked AFTER ownership so an unauthorised caller learns
    // nothing about our rollout state.
    const { data: settings } = await db
      .from('platform_settings').select('dtdc_enabled').eq('id', 1).maybeSingle();
    if (!settings?.dtdc_enabled || !shop.dtdc_enabled) {
      return decline('DTDC is not enabled for this shop');
    }

    const pickupPin = (shop.pincode ?? '').replace(/\D/g, '');
    if (pickupPin.length !== 6) return decline('the shop has no valid pickup pincode');
    const pickupAddress = (shop.address_line ?? '').trim();
    if (!pickupAddress) return decline('the shop has no pickup address');

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
    // Migration 0065. Product weights with a per-shop fallback, and the shop's
    // standard box, resolved in one place.
    const { data: metrics, error: metricsErr } = await userClient
      .rpc('order_parcel_metrics', { p_order_id: order.id })
      .maybeSingle<{ weight_kg: number; length_cm: number; breadth_cm: number; height_cm: number; is_estimated: boolean }>();
    if (metricsErr || !metrics) {
      return json({ error: metricsErr?.message ?? 'Could not work out the parcel weight' }, 422);
    }

    /* ── The destination state ──────────────────────────────────────────── */
    // Checkout never collected one. It comes from the same lazily-filled
    // `pincodes` directory (0077a) that priced this delivery, so the address we
    // book cannot disagree with the address we charged for.
    const { data: pin } = await db
      .from('pincodes').select('district, state').eq('pincode', dropPin).maybeSingle();

    const description = items
      .map((it) => `${it.title}${Number(it.qty) > 1 ? ` x${it.qty}` : ''}`)
      .join(', ')
      .slice(0, 100) || 'Ethnic wear';

    const bookingReq: BookingRequest = {
      reference: order.order_number,
      pickup: {
        name: shop.name,
        phone: (shop.phone ?? '').replace(/\D/g, '').slice(-10),
        address: pickupAddress,
        pincode: pickupPin,
        city: shop.city ?? shop.district ?? null,
        district: shop.district ?? null,
        state: shop.state ?? null,
      },
      drop: {
        name: (order.guest_name ?? '').trim() || 'Customer',
        phone: (order.guest_phone ?? '').replace(/\D/g, '').slice(-10),
        address,
        pincode: dropPin,
        city: (order.guest_city ?? '').trim() || (pin as { district?: string } | null)?.district || null,
        state: (pin as { state?: string } | null)?.state ?? null,
      },
      description,
      declaredValue: Number(order.total),
      weightKg: Number(metrics.weight_kg),
      lengthCm: Number(metrics.length_cm) || null,
      breadthCm: Number(metrics.breadth_cm) || null,
      heightCm: Number(metrics.height_cm) || null,
      sellerGstin: (shop.gst_number ?? '').trim() || null,
    };

    /* ── Book it ────────────────────────────────────────────────────────── */
    let booking;
    try {
      booking = await createConsignment(bookingReq);
    } catch (e) {
      // A business rejection — unserviceable, a field they dislike, a service
      // type not on the rate card — is a fall-through, not an error shown to
      // the seller. Logged, because a rejection that is really a misconfigured
      // DTDC_SERVICE_TYPE_ID would otherwise send every parcel to the next
      // carrier while this integration looked wired up.
      if (e instanceof DtdcError && e.unserviceable) {
        console.warn('dtdc-book declined', { orderId, reason: e.message });
        return decline(e.message);
      }
      throw e;
    }

    /* ── The label ──────────────────────────────────────────────────────── */
    // Best effort. A missing label costs the seller a download from the DTDC
    // portal; it does not invalidate a parcel that already has an AWB.
    let labelPath: string | null = null;
    try {
      const pdf = await fetchLabelPdf(booking.awb);
      const path = `${order.boutique_id}/${booking.awb}.pdf`;
      const { error: upErr } = await db.storage.from(LABEL_BUCKET).upload(path, pdf, {
        contentType: 'application/pdf',
        upsert: true,
      });
      if (upErr) console.warn('label upload failed', { awb: booking.awb, error: upErr.message });
      else labelPath = path;
    } catch (e) {
      console.warn('label fetch failed', { awb: booking.awb, error: (e as Error).message });
    }

    /* ── Record it, then ship it ────────────────────────────────────────── */
    const { error: shipErr } = await db.from('shipments').insert({
      order_id: order.id,
      boutique_id: order.boutique_id,
      courier_id: null,
      courier_name: 'DTDC',
      awb: booking.awb,
      tracking_url: booking.trackingUrl,
      provider: 'dtdc',
      dtdc_courier_partner: booking.courierPartner,
      label_path: labelPath,
      // Freight is on the monthly DTDC invoice, not in the booking reply —
      // which is why 0110's margin view tolerates a null `we_paid`.
      freight_charge: null,
      declared_weight_kg: metrics.weight_kg,
      created_by: user.id,
    });
    if (shipErr) {
      // Booked with DTDC but unknown to us. The one state that needs a human,
      // because a retry would book (and be billed for) a second parcel.
      console.error('shipment insert failed after booking', { awb: booking.awb, error: shipErr.message });
      return json({
        // `booked` tells book-parcel a real parcel exists despite the failure,
        // so it stops the chain instead of booking a second one elsewhere.
        booked: true,
        error: `The parcel was booked (DTDC AWB ${booking.awb}) but could not be saved. Do NOT book again — send this AWB to support.`,
      }, 500);
    }

    const { error: statusErr } = await db
      .from('orders').update({ status: 'shipped' }).eq('id', order.id);
    if (statusErr) {
      return json({
        booked: true,
        error: `Parcel booked (DTDC AWB ${booking.awb}) but the order status did not update: ${statusErr.message}`,
      }, 500);
    }

    // Schedule the collection for the slot the seller chose. Best-effort: the
    // consignment is already booked and single_pickup raises a pickup anyway,
    // so a scheduling hiccup must never fail a parcel that already exists.
    let pickupScheduled = false;
    if (date && slotStart && slotEnd) {
      try {
        const pk = await schedulePickup({
          date, slotStart, slotEnd,
          reference: order.order_number,
          pickup: {
            name: shop.name,
            phone: (shop.phone ?? '').replace(/\D/g, '').slice(-10),
            address: pickupAddress,
            pincode: pickupPin,
            city: shop.city ?? shop.district ?? null,
            state: shop.state ?? null,
          },
          totalItems: 1,
          totalWeightKg: Number(metrics.weight_kg),
        });
        pickupScheduled = Boolean(pk.pickupId) && !pk.failureReason;
        console.log('dtdc pickup scheduled', { awb: booking.awb, pickupId: pk.pickupId, failure: pk.failureReason });
      } catch (e) {
        console.warn('dtdc pickup scheduling failed', { awb: booking.awb, error: (e as Error).message });
      }
    }

    return json({
      ok: true,
      provider: 'dtdc',
      awb: booking.awb,
      courierName: 'DTDC',
      labelUrl: null,
      labelPath,
      pickupScheduled,
      freightCharge: null,
      weightKg: metrics.weight_kg,
      // The seller carries any weight-discrepancy charge, so they are told when
      // we declared a guess rather than a measured weight.
      weightEstimated: metrics.is_estimated,
    });
  } catch (e) {
    if (e instanceof DtdcError) {
      console.error('dtdc-book DtdcError', e.status, e.message, e.body);
      // A configuration or transport fault. Not a decline — but the
      // orchestrator still advances, because the order has to ship. Logged as
      // a FAULT so it is found, where a decline would be filed as "DTDC said no".
      //
      // Always 502 here, never DTDC's own 401/403: book-parcel treats 401/403
      // as "the SELLER is not allowed" and stops the chain. A bad DTDC_API_KEY
      // must send the parcel to Shiprocket, not strand every seller on the
      // manual form until someone reads the function log.
      return json({ error: e.message }, 502);
    }
    console.error('dtdc-book failed', e);
    return json({ error: e instanceof Error ? e.message : 'Booking failed' }, 500);
  }
});
