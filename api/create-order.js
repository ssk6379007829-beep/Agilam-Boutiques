import Razorpay from 'razorpay';

/**
 * Vercel serverless function: create a Razorpay order.
 *
 * The frontend (src/lib/razorpay.ts) calls this before opening the checkout
 * modal. The secret key is read from the server-only RAZORPAY_KEY_SECRET env
 * var and never leaves this function.
 */

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!keyId || !keySecret) {
    return res.status(401).json({ error: 'Razorpay credentials are not configured' });
  }

  const { amount, currency = 'INR', receipt } = req.body ?? {};
  const paise = Math.round(Number(amount));

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
