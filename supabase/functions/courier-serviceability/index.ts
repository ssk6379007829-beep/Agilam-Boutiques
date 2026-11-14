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
      courier_name?: string;
      rate?: number;
      estimated_delivery_days?: string;
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

    const cheapest = couriers.length
      ? couriers.reduce((a, b) => (Number(b.rate) < Number(a.rate) ? b : a))
      : null;

    return json({
      ok: true,
      origin,
      dest,
      serviceable: couriers.length > 0,
      courierCount: couriers.length,
      // Carried for later use (the "recommend cheapest" idea); callers ignore it
      // for now, since this release is serviceability only.
      cheapest: cheapest
        ? { name: cheapest.courier_name ?? null, rate: Number(cheapest.rate) || null, days: cheapest.estimated_delivery_days ?? null }
        : null,
    });
  } catch (e) {
    console.error('courier-serviceability failed', e);
    return json({ error: e instanceof Error ? e.message : 'Serviceability check failed' }, 500);
  }
});
