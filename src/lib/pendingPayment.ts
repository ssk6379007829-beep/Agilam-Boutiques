/**
 * Crash-safety for the gap between "Razorpay captured the money" and "the order
 * exists in our database".
 *
 * Those are two separate network calls (the checkout modal, then
 * /api/place-order), and everything in between — a dropped connection, a 500, a
 * closed tab — leaves the buyer charged with nothing to show for it. Recovering
 * that automatically is what api/razorpay-webhook.js can only do slowly and
 * manually; this does it immediately, from the buyer's own browser.
 *
 * So the verified payment is written here BEFORE place-order is attempted, and
 * only cleared once an order really came back. If a settlement is still parked
 * here on the next visit, the Payment screen offers to finish it — replaying the
 * same payment id, which costs the buyer nothing extra (place-order's replay
 * guard maps one payment to exactly one order-set).
 */

import type { PaymentInfo } from '@/state/ShopContext';

export type PendingOrderItem = { product_id: string; qty: number; size: string };

export type PendingPayment = {
  payment: PaymentInfo;
  /** The exact cart the payment was authorised for — replayed verbatim. */
  items: PendingOrderItem[];
  couponCode: string | null;
  /** Rupee total shown to the buyer, for the recovery banner's copy. */
  total: number;
  savedAt: string;
};

const KEY = 'agx-pending-payment';

/**
 * A settlement older than this is not offered for retry. By then Razorpay's
 * webhook backstop has long since flagged it for the operator, and silently
 * re-placing a days-old cart would surprise the buyer more than it helps.
 */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function savePendingPayment(p: Omit<PendingPayment, 'savedAt'>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...p, savedAt: new Date().toISOString() }));
  } catch {
    /* storage unavailable — recovery is best-effort, the webhook still catches it */
  }
}

export function readPendingPayment(): PendingPayment | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingPayment;
    if (!parsed?.payment?.razorpay_payment_id || !Array.isArray(parsed.items)) return null;
    if (Date.now() - new Date(parsed.savedAt).getTime() > MAX_AGE_MS) {
      clearPendingPayment();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingPayment(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to clean up */
  }
}
