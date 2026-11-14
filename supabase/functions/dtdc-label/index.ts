/**
 * Fetch a DTDC shipping label FRESH from DTDC, on demand.
 *
 * WHY THIS EXISTS
 * dtdc-book fetches the label once, best-effort, and stores it in the private
 * `shipping-labels` bucket. If that one fetch fails — a cold start, a blip, a
 * label not yet ready the instant the AWB is issued — `label_path` stays null
 * and the seller has NO way to get the label they must stick on the parcel.
 *
 * This closes that gap: the seller taps "Download label" and we pull the label
 * straight from DTDC every time (`/shippinglabel/stream`), re-store it (so the
 * saved copy heals), and hand back a short-lived signed URL. It always works as
 * long as the consignment exists at DTDC, independent of whether the
 * booking-time save succeeded.
 *
 * The label carries the buyer's name, address and phone, so it is never a
 * public object: it lives in the private bucket and is reached only through a
 * signed URL minted for the shop's owner here.
 *
 * Deployed by hand. Needs _shared/courier.ts and _shared/dtdc.ts alongside it.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { CORS, json, serviceClient } from '../_shared/courier.ts';
import { DtdcError, fetchLabelPdf } from '../_shared/dtdc.ts';

const LABEL_BUCKET = 'shipping-labels';

type ShipmentRow = {
  id: string;
  order_id: string;
  boutique_id: string;
  awb: string;
  provider: string | null;
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
      .select('id, order_id, boutique_id, awb, provider')
      .eq('order_id', orderId)
      .maybeSingle<ShipmentRow>();
    if (shipErr) return json({ error: shipErr.message }, 500);
    if (!shipment) return json({ error: 'This order has no parcel yet' }, 404);
    if (shipment.provider !== 'dtdc') {
      return json({ error: 'A DTDC label is only available for a DTDC booking' }, 409);
    }

    // Ownership: name the columns — `boutiques` has column-level grants.
    const { data: shop } = await db
      .from('boutiques')
      .select('id, owner_id')
      .eq('id', shipment.boutique_id)
      .maybeSingle<{ id: string; owner_id: string }>();
    if (!shop) return json({ error: 'Boutique not found' }, 404);
    if (shop.owner_id !== user.id) return json({ error: 'Not your order' }, 403);

    // Fresh from DTDC every time.
    let pdf: Uint8Array;
    try {
      pdf = await fetchLabelPdf(shipment.awb);
    } catch (e) {
      if (e instanceof DtdcError) {
        console.error('dtdc-label DtdcError', e.status, e.message, e.body);
        return json({ error: `DTDC could not produce the label: ${e.message}` }, 502);
      }
      throw e;
    }

    // Re-store, healing a label_path that an earlier best-effort fetch missed.
    const path = `${shipment.boutique_id}/${shipment.awb}.pdf`;
    const { error: upErr } = await db.storage.from(LABEL_BUCKET).upload(path, pdf, {
      contentType: 'application/pdf',
      upsert: true,
    });
    if (upErr) {
      console.error('dtdc-label upload failed', { awb: shipment.awb, error: upErr.message });
      return json({ error: `Could not save the label: ${upErr.message}` }, 500);
    }
    await db.from('shipments').update({ label_path: path }).eq('id', shipment.id);

    const { data: signed, error: signErr } = await db
      .storage.from(LABEL_BUCKET).createSignedUrl(path, 600);
    if (signErr || !signed?.signedUrl) {
      return json({ error: signErr?.message ?? 'Could not sign the label URL' }, 500);
    }

    return json({ ok: true, url: signed.signedUrl, awb: shipment.awb });
  } catch (e) {
    console.error('dtdc-label failed', e);
    return json({ error: e instanceof Error ? e.message : 'Could not get the label' }, 500);
  }
});
