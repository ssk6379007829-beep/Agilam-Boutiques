/**
 * Client-side pricing — what a bag costs, and what each coupon takes off it.
 *
 * This is the browser half of the rules in `api/_pricing.js`: the server
 * re-derives the same numbers and asserts the Razorpay payment matches them to
 * the paise, so the two files MUST stay in step. Change both together.
 *
 * Everything the UI needs to *preview* a coupon (before it's applied) comes
 * from here too, so a card can never promise a saving the totals won't give.
 */
import { COUPONS, type Coupon } from '@/data/demo';

export const FREE_SHIP_MIN = 2000;
export const SHIP_FEE = 99;

/**
 * The applied coupon, or undefined if it doesn't qualify. A flat coupon only
 * counts once its minimum subtotal is met; pct/ship apply whenever the code
 * matches.
 */
export function findCoupon(code: string | null, subtotal: number): Coupon | undefined {
  if (!code) return undefined;
  return COUPONS.find((c) => c.code === code && (c.type !== 'flat' || subtotal >= c.min));
}

/** Delivery before any coupon — free over the threshold, and on an empty bag. */
export function baseShipFee(subtotal: number): number {
  return subtotal === 0 || subtotal >= FREE_SHIP_MIN ? 0 : SHIP_FEE;
}

/** True once the bag is worth enough for this coupon to be usable. */
export function isEligible(coupon: Coupon, subtotal: number): boolean {
  return subtotal >= coupon.min;
}

/**
 * What this coupon is worth on the current bag — money off the goods, or the
 * delivery fee it waives. Zero is a real answer (FREESHIP on an order that
 * already ships free), which is why the coupon list shows it.
 */
export function couponSavings(coupon: Coupon, subtotal: number): number {
  if (!isEligible(coupon, subtotal)) return 0;
  if (coupon.type === 'pct') return Math.min(Math.round((subtotal * coupon.off) / 100), coupon.cap ?? Infinity);
  if (coupon.type === 'flat') return coupon.off;
  return baseShipFee(subtotal);
}

/** The bag's totals under an optional coupon code. */
export function computeTotals(subtotal: number, code: string | null) {
  const coupon = findCoupon(code, subtotal);
  const discount = coupon && coupon.type !== 'ship' ? couponSavings(coupon, subtotal) : 0;
  const shipFee = coupon?.type === 'ship' ? 0 : baseShipFee(subtotal);
  return { coupon, discount, shipFee, total: Math.max(0, subtotal - discount) + shipFee };
}
