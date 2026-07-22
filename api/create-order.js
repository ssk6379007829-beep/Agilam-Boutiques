import Razorpay from 'razorpay';
import { serviceClient } from './_supabase.js';
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
 * A legacy `amount` (paise) body is still accepted for callers that send no
 * `items` at all; when `items` are present the server price always wins and the
 * browser's figure is ignored entirely (see the fail-closed note in the handler).
 */

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Sum the server-priced goods value for the given cart items.
 *
 * Returns `{ ok: true, subtotal }` when the catalogue answered, or
 * `{ ok: false, reason }` when it could not. The two are kept apart on purpose:
 * "the catalogue is unreachable" and "none of these products exist" need
 * opposite answers from the caller, and collapsing them into a single `null`
 * is what previously let an unreachable database turn into a real charge.
 */
async function subtotalFromItems(items) {
  const ids = [...new Set(items.map((it) => it?.product_id).filter(Boolean))];
  if (ids.length === 0) return { ok: false, reason: 'EMPTY_CART' };

  const supabase = serviceClient(supabaseUrl, serviceRoleKey);
  if (!supabase) {
    console.error('create-order: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing or blank');
    return { ok: false, reason: 'CATALOGUE_UNAVAILABLE' };
  }

  let products;
  try {
    const { data, error } = await supabase.from('products').select('id, price').in('id', ids);
    if (error) throw error;
    products = data;
  } catch (err) {
    // Bad/expired service-role key, a paused project, a network blip — all land
    // here, and all mean the same thing: we cannot price this cart right now.
    console.error('create-order: catalogue lookup failed:', err?.message ?? err);
    return { ok: false, reason: 'CATALOGUE_UNAVAILABLE' };
  }

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
  return matched === 0 ? { ok: false, reason: 'EMPTY_CART' } : { ok: true, subtotal };
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

  // Amount the browser thinks it is charging. Only ever used by callers that
  // send no `items` at all; never as a fallback for a cart we failed to price.
  const clientPaise = Math.round(Number(amount));

  let paise;
  if (Array.isArray(items) && items.length > 0) {
    const priced = await subtotalFromItems(items);

    // ── Fail closed ────────────────────────────────────────────────────────
    // This used to fall back to the browser's amount whenever server pricing
    // was unavailable, reasoning that place-order re-binds the real amount at
    // settlement. That reasoning is wrong, because both functions depend on the
    // SAME service-role database client: if the catalogue can't be read here,
    // place-order's very first query fails too. Opening checkout anyway takes
    // the buyer's money and then guarantees "Could not place the order" —
    // charged, with nothing to show for it. Refusing to start is the only
    // honest outcome; the bag is untouched and the buyer can retry for free.
    if (!priced.ok) {
      if (priced.reason === 'EMPTY_CART') {
        return res.status(400).json({
          error: 'The items in your bag are no longer available. Please refresh your bag and try again.',
          code: 'EMPTY_CART',
        });
      }
      return res.status(503).json({
        error: 'We can’t take payments right now. Nothing has been charged — please try again in a few minutes.',
        code: 'CATALOGUE_UNAVAILABLE',
      });
    }

    paise = computeTotals(priced.subtotal, couponCode).totalPaise;
  } else {
    paise = clientPaise;
  }

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
