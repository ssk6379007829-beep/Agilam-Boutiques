/**
 * Razorpay Standard Checkout helper.
 *
 * The secret key never lives in the browser: order creation and signature
 * verification both run in the Vercel serverless functions under /api. This
 * module only loads the hosted checkout widget and talks to those endpoints.
 */

const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';
const KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID as string | undefined;

export type RazorpaySuccess = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type CheckoutInstance = {
  open: () => void;
  on: (event: string, cb: (resp: unknown) => void) => void;
};
type RazorpayCtor = new (options: Record<string, unknown>) => CheckoutInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayCtor;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = CHECKOUT_SRC;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => {
      scriptPromise = null;
      reject(new Error('Could not load the payment gateway. Check your connection.'));
    };
    document.body.appendChild(el);
  });
  return scriptPromise;
}

type PayArgs = {
  /** Amount in paise (₹1 = 100). Must be at least 100. */
  amountPaise: number;
  name: string;
  description?: string;
  receipt?: string;
  prefill?: { name?: string; email?: string; contact?: string };
};

/**
 * Runs the full checkout: creates an order on the server, opens the modal, and
 * verifies the signature on the server. Resolves only after a verified success.
 * Rejects with a user-facing message on cancel, failure, or verification error.
 */
export async function payWithRazorpay({
  amountPaise,
  name,
  description,
  receipt,
  prefill,
}: PayArgs): Promise<{ paymentId: string; orderId: string }> {
  await loadCheckout();
  if (!window.Razorpay) throw new Error('Payment gateway unavailable');

  const orderRes = await fetch('/api/create-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: amountPaise, currency: 'INR', receipt }),
  });
  if (!orderRes.ok) {
    const { error } = await orderRes.json().catch(() => ({ error: '' }));
    throw new Error(error || 'Could not start the payment. Please try again.');
  }
  const order = await orderRes.json();

  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay!({
      key: KEY_ID ?? order.key_id,
      order_id: order.order_id,
      amount: order.amount,
      currency: order.currency,
      name,
      description,
      prefill,
      theme: { color: '#D6336C' },
      modal: {
        // User closed the modal without paying.
        ondismiss: () => reject(new Error('Payment cancelled')),
      },
      handler: async (resp: RazorpaySuccess) => {
        try {
          const verifyRes = await fetch('/api/verify-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(resp),
          });
          const data = await verifyRes.json().catch(() => ({}));
          if (verifyRes.ok && data.verified) {
            resolve({ paymentId: resp.razorpay_payment_id, orderId: resp.razorpay_order_id });
          } else {
            reject(new Error(data.error || 'We could not verify your payment.'));
          }
        } catch {
          reject(new Error('We could not verify your payment.'));
        }
      },
    });

    rzp.on('payment.failed', (resp: unknown) => {
      const desc = (resp as { error?: { description?: string } })?.error?.description;
      reject(new Error(desc || 'Payment failed. Please try another method.'));
    });

    rzp.open();
  });
}
