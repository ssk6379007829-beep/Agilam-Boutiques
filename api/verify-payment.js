import crypto from 'node:crypto';
import { enforceRateLimit } from './_rateLimit.js';

/**
 * Vercel serverless function: verify a Razorpay payment signature.
 *
 * Razorpay signs `order_id|payment_id` with HMAC-SHA256 keyed by the secret.
 * We recompute it here and only report success on an exact, constant-time
 * match — the secret key stays server-side.
 */

const keySecret = process.env.RAZORPAY_KEY_SECRET;

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!enforceRateLimit(req, res, { key: 'verify-payment', limit: 30, windowMs: 60_000 })) return;

  if (!keySecret) {
    return res.status(401).json({ error: 'Razorpay credentials are not configured' });
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body ?? {};

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ verified: false, error: 'Missing payment verification fields' });
  }

  const expected = crypto
    .createHmac('sha256', keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  // Constant-time comparison; guard against length mismatch which would throw.
  const a = Buffer.from(expected);
  const b = Buffer.from(String(razorpay_signature));
  const valid = a.length === b.length && crypto.timingSafeEqual(a, b);

  if (!valid) {
    return res.status(400).json({ verified: false, error: 'Signature verification failed' });
  }

  return res.status(200).json({
    verified: true,
    payment_id: razorpay_payment_id,
    order_id: razorpay_order_id,
  });
}
