import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { css } from '@/lib/css';
import { useShop } from '@/state/ShopContext';
import { fmt } from '@/data/demo';

/**
 * The bag, as a floating button.
 *
 * Cart gave up its slot in the bottom nav to Inspire, so it lives here instead:
 * pinned bottom-right above the nav dock, across the buyer app. It only appears
 * once there is something in it — a permanent button reading "0" is noise, and
 * an empty bag has nothing to show.
 *
 * It hides itself on the screens that *are* the checkout flow, where a shortcut
 * back to the bag would be at best redundant and at worst a way to loop out of a
 * payment mid-flight.
 */

const HIDE_ON = ['/buyer/cart', '/buyer/checkout', '/buyer/payment', '/buyer/order-confirmation', '/buyer/chat'];

export function FloatingBag() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { cartCount, subtotal } = useShop();

  // Pulse when the count goes up, so adding from the feed is visibly acknowledged
  // even though the button is at the other end of the screen.
  const [bumped, setBumped] = useState(false);
  const previous = useRef(cartCount);
  useEffect(() => {
    if (cartCount > previous.current) {
      setBumped(true);
      const t = setTimeout(() => setBumped(false), 420);
      previous.current = cartCount;
      return () => clearTimeout(t);
    }
    previous.current = cartCount;
  }, [cartCount]);

  if (cartCount === 0) return null;
  if (HIDE_ON.some((p) => pathname.startsWith(p))) return null;

  return (
    <button
      onClick={() => navigate('/buyer/cart')}
      aria-label={`Open bag — ${cartCount} ${cartCount === 1 ? 'item' : 'items'}, ${fmt(subtotal)}`}
      className="agx-fab-bag"
      style={css(
        'display:flex;align-items:center;gap:10px;height:54px;padding:0 18px 0 14px;border:none;border-radius:18px;cursor:pointer;' +
          'background:linear-gradient(140deg,#E14A7E,#B02454 70%,#8E1C44);color:#fff;' +
          'box-shadow:0 1px 0 rgba(255,255,255,.35) inset,0 20px 40px -16px rgba(176,36,84,.95);' +
          `transition:transform .25s cubic-bezier(.2,.7,.2,1);transform:scale(${bumped ? 1.08 : 1});`,
      )}
    >
      <span style={css('position:relative;display:inline-flex;flex:none;')}>
        <span style={css("font-family:'Material Symbols Outlined';font-size:26px;")}>shopping_bag</span>
        <span style={css('position:absolute;top:-7px;right:-9px;min-width:19px;height:19px;padding:0 5px;border-radius:10px;background:#fff;color:#B02454;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;')}>
          {cartCount}
        </span>
      </span>
      <span style={css('display:flex;flex-direction:column;align-items:flex-start;line-height:1.15;')}>
        <span className="agx-eyebrow" style={css('font-size:8px;color:rgba(255,255,255,.8);')}>View bag</span>
        <span style={css('font-weight:800;font-size:14.5px;')}>{fmt(subtotal)}</span>
      </span>
    </button>
  );
}
