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
import { POLICY_TERMS } from '@/data/company';

export const FREE_SHIP_MIN = 2000;
export const SHIP_FEE = 99;

/**
 * Cash on Delivery.
 *
 * The fee is charged per delivery, not per cart: a bag spanning two boutiques
 * becomes two orders, shipped separately and collected in cash separately, so
 * one fee would leave the second boutique handling cash for nothing. The cart
 * itemises it as "× N deliveries" so the buyer is never surprised at the door.
 *
 * The cap applies to the WHOLE cart rather than each order, otherwise splitting
 * a ₹50,000 bag across five boutiques would dodge it.
 */
export const COD_FEE = POLICY_TERMS.codFee;
export const COD_MAX_ORDER = POLICY_TERMS.codMaxOrder;

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

/**
 * The bag's totals under an optional coupon code.
 *
 * `codDeliveries` is how many separate boutique orders the bag will split into
 * when paying cash — 0 for a prepaid order, which is what keeps the COD fee out
 * of every existing caller.
 */
export function computeTotals(subtotal: number, code: string | null, codDeliveries = 0) {
  const coupon = findCoupon(code, subtotal);
  const discount = coupon && coupon.type !== 'ship' ? couponSavings(coupon, subtotal) : 0;
  const shipFee = coupon?.type === 'ship' ? 0 : baseShipFee(subtotal);
  const codFee = Math.max(0, codDeliveries) * COD_FEE;
  return {
    coupon,
    discount,
    shipFee,
    codFee,
    total: Math.max(0, subtotal - discount) + shipFee + codFee,
  };
}

/**
 * Why this bag cannot be paid in cash, or null if it can.
 *
 * `codEnabledEverywhere` comes from the boutiques in the bag: a seller who
 * turned COD off in their store settings must not have cash orders forced on
 * them, so one opted-out boutique disqualifies the whole bag.
 */
export function codBlockedReason(
  subtotal: number,
  code: string | null,
  codEnabledEverywhere: boolean,
): string | null {
  if (!codEnabledEverywhere) return 'One of the boutiques in your bag does not accept cash on delivery.';
  const payable = computeTotals(subtotal, code).total;
  if (payable > COD_MAX_ORDER) {
    return `Cash on delivery is available on orders up to ₹${COD_MAX_ORDER.toLocaleString('en-IN')}.`;
  }
  return null;
}
