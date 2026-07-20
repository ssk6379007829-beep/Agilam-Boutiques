import Razorpay from 'razorpay';
import { createClient } from '@supabase/supabase-js';
import { computeTotals } from './_pricing.js';
import { enforceRateLimit } from './_rateLimit.js';

/**
 * Vercel serverless function: create a Razorpay order.
 *
 * The frontend (src/lib/razorpay.ts) calls this before opening the checkout
 * modal. The secret key is read from the server-only RAZORPAY_KEY_SECRET env
 * var and never leaves this function.
 *
 * Amount authority (defense-in-depth): the browser sends the cart `items`
 * (product ids + quantities) and an optional `couponCode`; the server looks up
 * authoritative prices from the DB and derives the exact paise via the shared
 * `_pricing.js` rules — the same value api/place-order.js re-verifies at
 * settlement. So the Razorpay order is created for a server-trusted amount and a
 * tampered client can't even open checkout at the wrong price.
 *
 * A legacy `amount` (paise) body is still accepted as a fallback so nothing
 * breaks if an older client is deployed against a newer function; when `items`
 * are present they always win.
 */

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Sum the server-priced goods value for the given cart items. Returns null when
// no items resolve to a real product, so the caller can reject.
async function subtotalFromItems(items) {
  if (!supabaseUrl || !serviceRoleKey) return null;
  const ids = [...new Set(items.map((it) => it?.product_id).filter(Boolean))];
  if (ids.length === 0) return null;

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: products, error } = await supabase
    .from('products')
    .select('id, price')
    .in('id', ids);
  if (error) throw error;

  const priceById = new Map((products ?? []).map((p) => [p.id, Number(p.price)]));
  let subtotal = 0;
  let matched = 0;
  for (const it of items) {
    const price = priceById.get(it?.product_id);
    if (price == null) continue;
    const qty = Math.max(1, Math.floor(Number(it.qty) || 1));
    subtotal += price * qty;
    matched += 1;
  }
  return matched === 0 ? null : subtotal;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!(await enforceRateLimit(req, res, { key: 'create-order', limit: 20, windowMs: 60_000 }))) return;

  if (!keyId || !keySecret) {
    return res.status(401).json({ error: 'Razorpay credentials are not configured' });
  }

  const { amount, items, couponCode, currency = 'INR', receipt } = req.body ?? {};

  // Fallback amount the browser shows in the modal. This is NOT the security
  // boundary — api/place-order.js authoritatively re-prices the cart and refuses
  // to settle unless the paid Razorpay amount matches. So create-order prefers a
  // server-derived amount for defense-in-depth, but must stay resilient: if that
  // lookup can't run, fall back to the client amount rather than blocking a
  // legitimate checkout (the real gate is still enforced at settlement).
  const clientPaise = Math.round(Number(amount));

  let paise;
  if (Array.isArray(items) && items.length > 0) {
    try {
      const subtotal = await subtotalFromItems(items);
      if (subtotal != null) {
        paise = computeTotals(subtotal, couponCode).totalPaise;
      }
    } catch (err) {
      // Log and fall through to the client amount — place-order still binds the
      // real amount at settlement, so this can't be used to underpay.
      console.error('create-order: server pricing unavailable, using client amount', err?.message ?? err);
    }
  }
  if (!Number.isFinite(paise)) paise = clientPaise;

  // Razorpay rejects anything below 100 paise (₹1).
  if (!Number.isFinite(paise) || paise < 100) {
    return res.status(400).json({ error: 'amount must be an integer of at least 100 paise' });
  }

  try {
    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const order = await razorpay.orders.create({
      amount: paise,
      currency,
      receipt: receipt || `rcpt_${Date.now()}`,
    });

    return res.status(200).json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: keyId, // publishable id — safe to expose to the browser
    });
  } catch (err) {
    // 401 from Razorpay means bad credentials; everything else is a server-side failure.
    const status = err?.statusCode === 401 ? 401 : 500;
    console.error('Razorpay order creation failed:', err?.error ?? err);
    return res.status(status).json({ error: 'Could not create payment order' });
  }
}
