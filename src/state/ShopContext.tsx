import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { COUPONS, type Coupon } from '@/data/demo';
import { useCatalog } from '@/state/CatalogContext';

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

export const DEFAULT_FILTERS: Filters = { maxPrice: 10000, cats: [], colors: [], occasions: [], sort: 'Latest' };

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

  lastOrderId: string;
  placeOrder: () => string;

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
  const { productById } = useCatalog();
  // Cart and wishlist start empty — real shoppers build them from the catalogue.
  const [wishlist, setWishlist] = useState<Record<string, boolean>>({});
  const [cart, setCart] = useState<Cart>({});
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [query, setQuery] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [payMethod, setPayMethod] = useState('cod');
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

  const placeOrder = useCallback(() => {
    const oid = '#AGL-2482';
    setCart({});
    setAppliedCoupon(null);
    setLastOrderId(oid);
    showToast('Order placed successfully');
    return oid;
  }, [showToast]);

  const value: ShopValue = {
    wishlist, toggleWish,
    cart, cartCount, addToCart, buyNow, cartQty, setCartSize, removeCart, clearCart,
    filters, setFilters, toggleFilter, setSort, setMaxPrice, resetFilters,
    query, setQuery,
    appliedCoupon, applyCoupon, removeCoupon,
    payMethod, setPayMethod,
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
