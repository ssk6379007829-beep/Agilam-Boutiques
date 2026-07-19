import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { COUPONS, type Coupon } from '@/data/demo';
import { useCatalog } from '@/state/CatalogContext';
import { EMPTY_GUEST, readGuest, writeGuest, hasContactDetails } from '@/lib/buyerDetails';
import { addOrders, type PlacedOrder, type PlacedOrderItem } from '@/lib/orderHistory';

/**
 * Cross-screen shop state, mirroring the `state` object of the design's
 * single-file component (cart, wishlist, filters, coupon, payment method).
 * The design drives everything from one component; here the screens are
 * routed, so the shared slice lives in this context instead.
 */

export type Filters = {
  maxPrice: number;
  cats: string[];
  colors: string[];
  occasions: string[];
  sort: string;
};

export type CartLine = { qty: number; size: string };
export type Cart = Record<string, CartLine>;

export type Guest = { name: string; phone: string; city: string; address: string };
export type PaymentInfo = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

export const DEFAULT_FILTERS: Filters = { maxPrice: 10000, cats: [], colors: [], occasions: [], sort: 'Latest' };

// Buyers browse anonymously — their details start empty and are captured (and
// persisted) the first time they chat or check out. See `@/lib/buyerDetails`.
export const DEFAULT_GUEST: Guest = EMPTY_GUEST;

type ShopValue = {
  wishlist: Record<string, boolean>;
  toggleWish: (id: string) => void;

  cart: Cart;
  cartCount: number;
  addToCart: (id: string) => void;
  buyNow: (id: string) => void;
  cartQty: (id: string, delta: number) => void;
  setCartSize: (id: string, size: string) => void;
  removeCart: (id: string) => void;
  clearCart: () => void;

  filters: Filters;
  setFilters: (next: Filters) => void;
  toggleFilter: (group: 'cats' | 'colors' | 'occasions', value: string) => void;
  setSort: (v: string) => void;
  setMaxPrice: (v: number) => void;
  resetFilters: () => void;

  query: string;
  setQuery: (q: string) => void;

  appliedCoupon: string | null;
  applyCoupon: (code: string) => void;
  removeCoupon: () => void;

  payMethod: string;
  setPayMethod: (m: string) => void;

  guest: Guest;
  setGuest: (patch: Partial<Guest>) => void;
  /** Clears guest details and resets to empty state. */
  clearGuest: () => void;
  /** True once the buyer has saved a valid name + phone. */
  hasBuyerDetails: boolean;

  lastOrderId: string;
  /**
   * Creates the real order(s) server-side (one per boutique) and returns the
   * primary order number. Pass the verified Razorpay payment for online orders,
   * or `null` for Cash on Delivery. Throws with a user-facing message on failure.
   */
  placeOrder: (payment: PaymentInfo | null) => Promise<string>;

  toast: string | null;
  showToast: (msg: string) => void;

  sellModal: boolean;
  openSellModal: () => void;
  closeSellModal: () => void;

  /** Totals derived from the cart, matching the design's pricing rules. */
  subtotal: number;
  discount: number;
  shipFee: number;
  total: number;
  coupon: Coupon | undefined;
};

const ShopContext = createContext<ShopValue | null>(null);

export function ShopProvider({ children }: { children: ReactNode }) {
  const { productById, boutiques } = useCatalog();
  // Cart and wishlist start empty — real shoppers build them from the catalogue.
  const [wishlist, setWishlist] = useState<Record<string, boolean>>({});
  const [cart, setCart] = useState<Cart>({});
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [query, setQuery] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [payMethod, setPayMethod] = useState('cod');
  const [guest, setGuestState] = useState<Guest>(() => readGuest());
  const [lastOrderId, setLastOrderId] = useState('#AGL-2481');
  const [toast, setToast] = useState<string | null>(null);
  const [sellModal, setSellModal] = useState(false);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  const toggleWish = useCallback((id: string) => {
    setWishlist((w) => {
      const next = { ...w };
      if (next[id]) delete next[id];
      else next[id] = true;
      return next;
    });
  }, []);

  const addToCart = useCallback((id: string) => {
    setCart((c) => ({ ...c, [id]: { qty: (c[id]?.qty ?? 0) + 1, size: c[id]?.size ?? 'M' } }));
    showToast('Added to cart');
  }, [showToast]);

  const buyNow = useCallback((id: string) => {
    setCart((c) => (c[id] ? c : { ...c, [id]: { qty: 1, size: 'M' } }));
  }, []);

  const cartQty = useCallback((id: string, delta: number) => {
    setCart((c) => {
      const line = c[id];
      if (!line) return c;
      const qty = line.qty + delta;
      const next = { ...c };
      if (qty <= 0) delete next[id];
      else next[id] = { ...line, qty };
      return next;
    });
  }, []);

  const setCartSize = useCallback((id: string, size: string) => {
    setCart((c) => (c[id] ? { ...c, [id]: { ...c[id], size } } : c));
  }, []);

  const removeCart = useCallback((id: string) => {
    setCart((c) => {
      const next = { ...c };
      delete next[id];
      return next;
    });
    showToast('Removed from cart');
  }, [showToast]);

  const clearCart = useCallback(() => setCart({}), []);

  const toggleFilter = useCallback((group: 'cats' | 'colors' | 'occasions', value: string) => {
    setFilters((f) => {
      const arr = f[group];
      return { ...f, [group]: arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value] };
    });
  }, []);

  const setSort = useCallback((v: string) => setFilters((f) => ({ ...f, sort: v })), []);
  const setMaxPrice = useCallback((v: number) => setFilters((f) => ({ ...f, maxPrice: v })), []);
  const resetFilters = useCallback(() => setFilters(DEFAULT_FILTERS), []);

  const applyCoupon = useCallback((code: string) => {
    setAppliedCoupon(code);
    showToast(code + ' applied');
  }, [showToast]);

  const removeCoupon = useCallback(() => setAppliedCoupon(null), []);

  const cartCount = useMemo(
    () => Object.values(cart).reduce((a, l) => a + l.qty, 0),
    [cart],
  );

  const subtotal = useMemo(
    () => Object.entries(cart).reduce((sum, [id, line]) => {
      const p = productById(id);
      return sum + (p ? p.price * line.qty : 0);
    }, 0),
    [cart, productById],
  );

  // Mirrors the design: a flat coupon only counts once its minimum is met.
  const coupon = useMemo(
    () => COUPONS.find((c) => c.code === appliedCoupon && (c.type !== 'flat' || subtotal >= c.min)),
    [appliedCoupon, subtotal],
  );

  const discount = useMemo(() => {
    if (!coupon) return 0;
    if (coupon.type === 'pct') return Math.min(Math.round((subtotal * coupon.off) / 100), coupon.cap ?? Infinity);
    if (coupon.type === 'flat') return coupon.off;
    return 0;
  }, [coupon, subtotal]);

  const shipFee = useMemo(() => {
    const freeShip = coupon?.type === 'ship';
    const base = subtotal === 0 || subtotal >= 2000 ? 0 : 99;
    return freeShip ? 0 : base;
  }, [coupon, subtotal]);

  const total = useMemo(() => Math.max(0, subtotal - discount) + shipFee, [subtotal, discount, shipFee]);

  const setGuest = useCallback(
    (patch: Partial<Guest>) =>
      setGuestState((g) => {
        const next = { ...g, ...patch };
        writeGuest(next);
        return next;
      }),
    [],
  );

  const clearGuest = useCallback(() => {
    setGuestState(EMPTY_GUEST);
    writeGuest(EMPTY_GUEST);
  }, []);

  const hasBuyerDetails = useMemo(() => hasContactDetails(guest), [guest]);

  const placeOrder = useCallback(async (payment: PaymentInfo | null): Promise<string> => {
    // The server prices the order from the product ids, so the browser only
    // sends what it can't derive: which products, how many, and the size.
    const items = Object.entries(cart).map(([product_id, line]) => ({
      product_id,
      qty: line.qty,
      size: line.size,
    }));
    if (items.length === 0) throw new Error('Your bag is empty');

    const res = await fetch('/api/place-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, guest, payment }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      orders?: { order_number: string; boutique_id: string }[];
      error?: string;
    };
    if (!res.ok || !data.orders?.length) {
      throw new Error(data.error || 'Could not place the order. Please try again.');
    }

    // Mirror the just-paid cart into the buyer's local order history, grouped by
    // boutique the same way the server split it. Guest orders can't be read back
    // from Supabase (RLS), so this is what powers "My orders" and tracking.
    const boutiqueIdByName = new Map(boutiques.map((b) => [b.name, b.id]));
    const itemsByBoutique = new Map<string, PlacedOrderItem[]>();
    for (const [pid, line] of Object.entries(cart)) {
      const p = productById(pid);
      if (!p) continue;
      const bid = boutiqueIdByName.get(p.boutique);
      if (!bid) continue;
      const arr = itemsByBoutique.get(bid) ?? [];
      arr.push({ pid, title: p.title, tone: p.tone, qty: line.qty, size: line.size, price: p.price });
      itemsByBoutique.set(bid, arr);
    }
    const placedAt = new Date().toISOString();
    const placed: PlacedOrder[] = data.orders.map((o) => {
      const items = itemsByBoutique.get(o.boutique_id) ?? [];
      return {
        id: '#' + o.order_number,
        orderNumber: o.order_number,
        placedAt,
        boutique: boutiques.find((b) => b.id === o.boutique_id)?.name ?? 'Boutique',
        boutiqueId: o.boutique_id,
        status: 'pending',
        total: items.reduce((s, it) => s + it.price * it.qty, 0),
        items,
      };
    });
    addOrders(placed);

    const oid = data.orders[0].order_number;
    setCart({});
    setAppliedCoupon(null);
    setLastOrderId(oid);
    showToast('Order placed successfully');
    return oid;
  }, [cart, guest, boutiques, productById, showToast]);

  const value: ShopValue = {
    wishlist, toggleWish,
    cart, cartCount, addToCart, buyNow, cartQty, setCartSize, removeCart, clearCart,
    filters, setFilters, toggleFilter, setSort, setMaxPrice, resetFilters,
    query, setQuery,
    appliedCoupon, applyCoupon, removeCoupon,
    payMethod, setPayMethod,
    guest, setGuest, clearGuest, hasBuyerDetails,
    lastOrderId, placeOrder,
    toast, showToast,
    sellModal,
    openSellModal: useCallback(() => setSellModal(true), []),
    closeSellModal: useCallback(() => setSellModal(false), []),
    subtotal, discount, shipFee, total, coupon,
  };

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop() {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error('useShop must be used within a ShopProvider');
  return ctx;
}
