/**
 * Server-side pricing — the single source of truth for what a cart costs.
 *
 * These rules MUST stay identical to the client's ShopContext totals
 * (src/state/ShopContext.tsx) and the coupon table in src/data/demo.ts, because
 * api/place-order.js re-derives the amount here and asserts that the Razorpay
 * order was created (and paid) for exactly this many paise. Any drift between
 * this file and the client would reject legitimate checkouts, so change both
 * together.
 *
 * The leading underscore keeps this out of Vercel's /api routing — it is a
 * helper imported by place-order.js, not an endpoint.
 */

// Mirror of src/data/demo.ts COUPONS (only the fields pricing depends on).
export const COUPONS = [
  { code: 'WELCOME10', off: 10, type: 'pct', min: 0, cap: 600 },
  { code: 'FESTIVE500', off: 500, type: 'flat', min: 5000 },
  { code: 'FREESHIP', off: 0, type: 'ship', min: 0 },
];

// Mirror of ShopContext `coupon` memo: a flat coupon only counts once its
// minimum subtotal is met; pct/ship apply whenever the code matches.
export function findCoupon(code, subtotal) {
  if (!code) return undefined;
  return COUPONS.find((c) => c.code === code && (c.type !== 'flat' || subtotal >= c.min));
}

/**
 * Given the DB-derived subtotal (in rupees) and an optional coupon code,
 * return { discount, shipFee, total, totalPaise } using the exact same
 * arithmetic as the browser so the paise value matches to the rupee.
 */
export function computeTotals(subtotal, couponCode) {
  const coupon = findCoupon(couponCode, subtotal);

  let discount = 0;
  if (coupon) {
    if (coupon.type === 'pct') {
      discount = Math.min(Math.round((subtotal * coupon.off) / 100), coupon.cap ?? Infinity);
    } else if (coupon.type === 'flat') {
      discount = coupon.off;
    }
  }

  const freeShip = coupon?.type === 'ship';
  const baseShip = subtotal === 0 || subtotal >= 2000 ? 0 : 99;
  const shipFee = freeShip ? 0 : baseShip;

  const total = Math.max(0, subtotal - discount) + shipFee;
  return { discount, shipFee, total, totalPaise: Math.round(total * 100) };
}
