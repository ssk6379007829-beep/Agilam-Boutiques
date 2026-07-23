import { supabase } from '@/lib/supabase';

/**
 * Live "who's on the site right now" presence.
 *
 * Every open tab — signed-in or an anonymous guest — joins one shared Realtime
 * presence channel and broadcasts a small state blob (who they are, what page
 * they're on, when they were last active). The admin console subscribes to the
 * same channel read-only and renders the roster live. Presence is ephemeral: it
 * lives in the channel, not the database, so a closed tab or dropped connection
 * clears itself automatically — no cron, no stale "online" rows.
 *
 * Mirrors the per-conversation presence already used in chat.ts, scaled to one
 * site-wide channel.
 */

const SITE_CHANNEL = 'presence:site';

export type PresenceRole = 'guest' | 'buyer' | 'seller' | 'admin';
export type PresenceSection = 'buyer' | 'seller' | 'admin' | 'auth';

export interface PresenceMeta {
  id: string; // stable per-browser id (guests included)
  name: string; // display name, or "Guest"
  role: PresenceRole;
  page: string; // friendly activity label, e.g. "Viewing a product"
  section: PresenceSection;
  path: string; // raw pathname (for reference)
  at: string; // ISO timestamp of last activity (navigation / heartbeat)
}

export interface OnlineUser extends PresenceMeta {
  onlineSince: string; // earliest tracked timestamp for this session
}

const ID_KEY = 'agx-presence-id';

/** A durable id for this browser so a guest keeps one identity across pages. */
export function presenceId(): string {
  try {
    let id = localStorage.getItem(ID_KEY);
    if (!id) {
      id = (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)) as string;
      localStorage.setItem(ID_KEY, id);
    }
    return id;
  } catch {
    return Math.random().toString(36).slice(2);
  }
}

/** Turn a route into a human-readable "what they're doing" label. */
export function describePage(path: string): { page: string; section: PresenceSection } {
  const p = path.toLowerCase();
  if (p.startsWith('/admin')) return { page: 'Admin console', section: 'admin' };
  if (p.startsWith('/seller')) return { page: 'Seller console', section: 'seller' };
  if (p.startsWith('/auth') || p === '/') return { page: 'Signing in', section: 'auth' };

  // Buyer surface — the public storefront.
  if (p.includes('/product/') || p.startsWith('/b/')) return { page: 'Viewing a product', section: 'buyer' };
  if (p.includes('/boutique')) return { page: 'Viewing a boutique', section: 'buyer' };
  if (p.includes('/checkout')) return { page: 'At checkout', section: 'buyer' };
  if (p.includes('/payment')) return { page: 'Paying', section: 'buyer' };
  if (p.includes('/order-confirmation')) return { page: 'Order placed', section: 'buyer' };
  if (p.includes('/orders')) return { page: 'Viewing orders', section: 'buyer' };
  if (p.includes('/cart')) return { page: 'In their cart', section: 'buyer' };
  if (p.includes('/wishlist')) return { page: 'Browsing wishlist', section: 'buyer' };
  if (p.includes('/results') || p.includes('/filter') || p.includes('/sort')) return { page: 'Searching products', section: 'buyer' };
  if (p.includes('/messages') || p.includes('/chat')) return { page: 'Chatting', section: 'buyer' };
  if (p.includes('/inspire')) return { page: 'On the Inspire feed', section: 'buyer' };
  if (p.includes('/collections') || p.includes('/new-arrivals') || p.includes('/best-sellers') || p.includes('/top-boutiques')) {
    return { page: 'Exploring collections', section: 'buyer' };
  }
  if (p.includes('/profile')) return { page: 'On their profile', section: 'buyer' };
  if (p.includes('/home')) return { page: 'Browsing home', section: 'buyer' };
  return { page: 'Browsing', section: 'buyer' };
}

export interface PresenceHandle {
  update: () => void;
  leave: () => void;
}

/**
 * Publisher — join the site channel and keep this session's state fresh.
 * `getMeta` is read on every (re)track so callers can always hand back the
 * latest page/name without re-joining.
 */
export function joinPresence(getMeta: () => PresenceMeta): PresenceHandle {
  const channel = supabase.channel(SITE_CHANNEL, {
    config: { presence: { key: getMeta().id } },
  });

  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') void channel.track(getMeta());
  });

  return {
    update: () => {
      void channel.track(getMeta());
    },
    leave: () => {
      void channel.untrack();
      supabase.removeChannel(channel);
    },
  };
}

/**
 * Subscriber (admin) — read the live roster. Deliberately does NOT track, so
 * opening the admin panel doesn't add a phantom session to the list.
 */
export function subscribeToOnlineUsers(onChange: (users: OnlineUser[]) => void) {
  const channel = supabase.channel(SITE_CHANNEL, {
    config: { presence: { key: `admin-viewer-${presenceId()}` } },
  });

  const report = () => {
    const state = channel.presenceState<PresenceMeta>();
    const users: OnlineUser[] = Object.values(state)
      .map((metas) => {
        // One session can have several presence refs (tabs); collapse to the
        // most recent activity, and keep the earliest as "online since".
        const sorted = [...metas].sort((a, b) => a.at.localeCompare(b.at));
        const latest = sorted[sorted.length - 1];
        return { ...latest, onlineSince: sorted[0].at };
      })
      .sort((a, b) => b.at.localeCompare(a.at));
    onChange(users);
  };

  channel
    .on('presence', { event: 'sync' }, report)
    .on('presence', { event: 'join' }, report)
    .on('presence', { event: 'leave' }, report)
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
