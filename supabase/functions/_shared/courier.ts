/**
 * Helpers every courier integration needs, independent of which courier.
 *
 * These three were written inside `_shared/shiprocket.ts` when Shiprocket was
 * the only provider. Shadowfax needs the same ones, and a file called
 * `shadowfax.ts` importing them from `shiprocket.ts` would read as a mistake to
 * the next person — so they live here instead.
 *
 * `_shared/shiprocket.ts` keeps its own copies and is deliberately NOT
 * refactored onto this file: it is the live booking path for real money, and
 * nothing here is worth touching it for. Worth folding in the next time that
 * file is edited for its own reasons.
 */

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  );
}

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** Every response carries CORS — the seller console calls these from the
 *  browser, so an error without the headers reaches the UI as an opaque
 *  network failure instead of the message we bothered to write. */
export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

/**
 * Constant-time string compare, for webhook shared secrets.
 *
 * A plain `===` on a secret leaks its length and prefix to a patient caller,
 * and these endpoints can mark an order delivered — which releases a payout.
 */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** The six stages `shipment_events.stage` accepts (migration 0067). */
export type ScanStage =
  | 'picked_up' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'rto' | 'failed';
