import type { Guest } from '@/state/ShopContext';

/**
 * The buyer's contact/delivery details — name, phone, city, address, pincode.
 *
 * Buyers browse and order signed out by design, so this is how we remember who
 * they are across the anonymous chat identity and guest checkout: capture the
 * details once, reuse everywhere.
 *
 * Persisted to `localStorage` (like the bag, saved items and pincode in
 * `@/lib/buyerLocal`) so a returning buyer's address is already filled in and
 * every future order reuses it, instead of being re-typed on each visit — a
 * refresh, a cold product link, the chunk reload in `@/lib/appUpdate`, or the
 * redirect back from the payment gateway would otherwise empty it. A module
 * cache fronts the store so `readGuest()` stays a cheap synchronous call.
 *
 * Cleared on logout: `clearGuest()` in `ShopContext` writes `EMPTY_GUEST`
 * through `writeGuest`, which removes the stored copy — so a name, phone and
 * address never leak to the next person on a shared device.
 */

const DETAILS_KEY = 'agx:buyer-details';

export const EMPTY_GUEST: Guest = { name: '', phone: '', city: '', address: '', pincode: '' };

/**
 * Anything could be sitting under our key (an older build, a hand-edit), so the
 * stored shape is validated rather than trusted — any missing or non-string
 * field falls back to empty, never reaching the form or the order as
 * `undefined`.
 */
function parseGuest(raw: unknown): Guest | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const str = (v: unknown): string => (typeof v === 'string' ? v : '');
  return {
    name: str(r.name),
    phone: str(r.phone),
    city: str(r.city),
    address: str(r.address),
    pincode: str(r.pincode),
  };
}

/**
 * Storage can throw rather than merely fail (Safari private mode, a full quota,
 * storage blocked by policy), and the buyer's session is never worth taking the
 * page down for, so every access is guarded and falls back to "nothing saved".
 */
function readStored(): Guest {
  try {
    const raw = localStorage.getItem(DETAILS_KEY);
    if (!raw) return EMPTY_GUEST;
    return parseGuest(JSON.parse(raw)) ?? EMPTY_GUEST;
  } catch {
    return EMPTY_GUEST;
  }
}

let guestState: Guest = readStored();

export function readGuest(): Guest {
  return guestState;
}

export function writeGuest(g: Guest): void {
  guestState = g;
  try {
    // Nothing worth keeping (e.g. the EMPTY_GUEST that logout writes) clears the
    // key outright rather than leaving an empty record behind.
    if (hasContactDetails(g) || g.address.trim() || g.city.trim() || g.pincode.trim()) {
      localStorage.setItem(DETAILS_KEY, JSON.stringify(g));
    } else {
      localStorage.removeItem(DETAILS_KEY);
    }
  } catch {
    /* storage unavailable or full — details stay in memory for this session */
  }
}

/** Indian 10-digit mobile number. */
export function phoneOk(phone: string): boolean {
  return /^\d{10}$/.test(phone.trim());
}

export function nameOk(name: string): boolean {
  return name.trim().length >= 2;
}

/** Indian 6-digit PIN code (first digit 1–9). */
export function pincodeOk(pincode: string): boolean {
  return /^[1-9]\d{5}$/.test(pincode.trim());
}

/** The minimum needed to start a chat or place an order: a name and a phone. */
export function hasContactDetails(g: Guest): boolean {
  return nameOk(g.name) && phoneOk(g.phone);
}

/** Everything checkout needs to ship an order. */
export function hasDeliveryDetails(g: Guest): boolean {
  return (
    hasContactDetails(g) &&
    g.address.trim().length >= 5 &&
    g.city.trim().length >= 2 &&
    pincodeOk(g.pincode)
  );
}
