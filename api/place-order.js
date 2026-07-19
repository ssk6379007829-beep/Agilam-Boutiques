import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

/**
 * Vercel serverless function: create the real order(s) for a guest checkout.
 *
 * Buyers browse without an account, so orders are written here with the Supabase
 * service role (bypasses RLS) instead of from the anonymous browser client. The
 * server is the source of truth for prices and boutique ownership: the client
 * only sends product ids + quantities, and we look up the authoritative title,
 * price and boutique from the products table. A cart can span several
 * boutiques, so it is split into one order per boutique — that is what makes
 * each seller see only their own items.
 *
 * For online payments we re-verify the Razorpay signature here (the same HMAC
 * as verify-payment.js) so an order can't be forged without a genuine payment.
 */

const keySecret = process.env.RAZORPAY_KEY_SECRET;
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function verifySignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
  if (!keySecret || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) return false;
  const expected = crypto
    .createHmac('sha256', keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(razorpay_signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function orderNumber() {
  return 'AGL-' + Date.now().toString().slice(-7) + Math.floor(Math.random() * 10);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Order service is not configured (missing Supabase service role)' });
  }

  const { items, guest, payment } = req.body ?? {};

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Cart is empty' });
  }

  // Online payment must carry a valid signature; a null payment means Cash on Delivery.
  if (payment && !verifySignature(payment)) {
    return res.status(400).json({ error: 'Payment could not be verified' });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // A signed-in buyer (Google / email) sends their access token; tie the order
  // to their account so they can read it back cross-device via RLS. Guests
  // (no token / invalid) fall through to null, staying phone-keyed.
  let buyerId = null;
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (token) {
    try {
      const { data } = await supabase.auth.getUser(token);
      buyerId = data?.user?.id ?? null;
    } catch {
      /* invalid token — treat as a guest checkout */
    }
  }

  try {
    // Authoritative product data — never trust prices sent by the browser.
    const ids = [...new Set(items.map((it) => it?.product_id).filter(Boolean))];
    if (ids.length === 0) return res.status(400).json({ error: 'No valid products in cart' });

    const { data: products, error: prodErr } = await supabase
      .from('products')
      .select('id, title, price, color, boutique_id')
      .in('id', ids);
    if (prodErr) throw prodErr;

    const byId = new Map((products ?? []).map((p) => [p.id, p]));

    // Group order lines by boutique so each seller gets their own order.
    const groups = new Map();
    for (const it of items) {
      const p = byId.get(it?.product_id);
      if (!p) continue; // unknown/removed product — skip
      const qty = Math.max(1, Math.floor(Number(it.qty) || 1));
      const line = {
        product_id: p.id,
        title: p.title,
        price: Number(p.price),
        qty,
        size: it.size ?? null,
        color: p.color ?? null,
      };
      const g = groups.get(p.boutique_id) ?? { boutique_id: p.boutique_id, lines: [], total: 0 };
      g.lines.push(line);
      g.total += line.price * qty;
      groups.set(p.boutique_id, g);
    }

    if (groups.size === 0) {
      return res.status(400).json({ error: 'None of the cart items are still available' });
    }

    const guestFields = {
      guest_name: guest?.name ?? null,
      guest_phone: guest?.phone ?? null,
      guest_city: guest?.city ?? null,
      guest_address: guest?.address ?? null,
      payment_id: payment?.razorpay_payment_id ?? null,
    };

    const created = [];
    for (const g of groups.values()) {
      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber(),
          buyer_id: null,
          boutique_id: g.boutique_id,
          total: g.total,
          status: 'pending',
          ...guestFields,
        })
        .select('id, order_number, boutique_id')
        .single();
      if (orderErr) throw orderErr;

      const { error: itemsErr } = await supabase
        .from('order_items')
        .insert(g.lines.map((l) => ({ ...l, order_id: order.id })));
      if (itemsErr) throw itemsErr;

      created.push({ order_number: order.order_number, boutique_id: order.boutique_id });
    }

    return res.status(200).json({ orders: created });
  } catch (err) {
    console.error('place-order failed:', err?.message ?? err);
    return res.status(500).json({ error: 'Could not place the order. Please try again.' });
  }
}
