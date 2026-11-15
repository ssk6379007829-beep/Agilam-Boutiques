/**
 * Can a parcel actually be delivered to this pincode?
 *
 * Uses SHIPROCKET's serviceability endpoint — the one real source we have.
 * DTDC's own API can't answer this (its serviceability endpoint returns the
 * same 68 services for every pincode, including fake ones — probed 2026-11-15),
 * and Shiprocket is an aggregator, so "does ANY courier serve this lane" is
 * exactly what it knows. Price is read too (the cheapest rate) but is NOT
 * surfaced yet — this is a deliverability check, used at the buyer's checkout
 * (warn before paying) and the seller's ship step (don't offer a dead lane).
 *
 * Callable by anonymous buyers (the storefront anon key satisfies verify_jwt on
 * this project) and signed-in sellers. Shiprocket credentials never leave the
 * server; the browser only sends two pincodes and an optional weight.
 *
 * Fails OPEN: if Shiprocket auth or the API is down, it returns
 * serviceable:null (degraded) rather than false, so an outage never blocks a
 * sale — the booking chain still runs at ship time either way.
 *
 * Deployed by hand. Needs _shared/shiprocket.ts alongside it.
 */

import { CORS, SrError, getToken, json, serviceClient, srFetch } from '../_shared/shiprocket.ts';

type ServiceabilityResponse = {
  data?: {
    available_courier_companies?: {
      courier_company_id?: number | string;
      courier_name?: string;
      rate?: number;
      estimated_delivery_days?: string;
      etd?: string;
    }[];
  };
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { originPincode, destPincode, weightKg } = await req.json().catch(() => ({}));
    const origin = String(originPincode ?? '').replace(/\D/g, '');
    const dest = String(destPincode ?? '').replace(/\D/g, '');
    if (origin.length !== 6 || dest.length !== 6) {
      return json({ error: 'originPincode and destPincode must both be 6 digits' }, 400);
    }
    // A typical ethnic-wear parcel if the caller gives no weight — enough to get
    // a representative serviceability answer at checkout, before the real parcel
    // is known. The ship step passes the order's actual weight.
    const weight = Math.max(0.1, Number(weightKg) || 0.5);

    const db = serviceClient();

    let couriers: NonNullable<NonNullable<ServiceabilityResponse['data']>['available_courier_companies']> = [];
    try {
      const token = await getToken(db);
      const res = await srFetch<ServiceabilityResponse>(
        token,
        `/courier/serviceability/?pickup_postcode=${origin}&delivery_postcode=${dest}&weight=${weight}&cod=0`,
      );
      couriers = res?.data?.available_courier_companies ?? [];
    } catch (e) {
      // Fail OPEN. A credential or outage fault must not read as "undeliverable"
      // and block checkout — report degraded and let the caller proceed.
      const msg = e instanceof SrError ? e.message : (e as Error).message;
      console.error('courier-serviceability: Shiprocket check failed', { origin, dest, error: msg });
      return json({ ok: true, degraded: true, origin, dest, serviceable: null, courierCount: 0, cheapest: null });
    }

    // The full list the seller picks from — each real courier with its live
    // rate (the PLATFORM's cost) and ETA. Sorted cheapest-first; the cheapest
    // is flagged so the UI can tag and pre-highlight it.
    const list = couriers
      .map((c) => ({
        courierId: c.courier_company_id != null ? String(c.courier_company_id) : null,
        name: c.courier_name ?? null,
        rate: Number.isFinite(Number(c.rate)) ? Number(c.rate) : null,
        days: c.estimated_delivery_days ?? c.etd ?? null,
      }))
      .filter((c) => c.courierId && c.name)
      .sort((a, b) => (a.rate ?? Infinity) - (b.rate ?? Infinity));

    const cheapest = list.length ? list[0] : null;

    return json({
      ok: true,
      origin,
      dest,
      serviceable: couriers.length > 0,
      courierCount: couriers.length,
      couriers: list,
      cheapest,
    });
  } catch (e) {
    console.error('courier-serviceability failed', e);
    return json({ error: e instanceof Error ? e.message : 'Serviceability check failed' }, 500);
  }
});
