import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { useShop } from '@/state/ShopContext';
import { useAsync } from '@/hooks/useAsync';
import { fetchMyBoutique } from '@/data/boutiques';
import { resolveLocation } from '@/lib/geolocate';
import { recordVisitBeat } from '@/data/visits';
import { joinPresence, presenceId, describePage, type PresenceHandle, type PresenceMeta, type PresenceRole } from '@/lib/presence';

/**
 * Broadcasts this tab's live presence to the shared site channel so the admin
 * console can see who is currently on the site and what they're doing. Mounted
 * once, app-wide (App.tsx), inside the auth + shop providers. Renders nothing.
 *
 * It does TWO things with the same state blob, and they are deliberately
 * separate systems:
 *
 *   • Realtime presence — "who is online right now". Ephemeral by design; a
 *     closed tab clears itself and nothing is kept.
 *   • A `track_visit` beat (migration 0107) — the durable record, so the
 *     console can still answer "who visited yesterday, and for how long" after
 *     every one of those tabs has closed.
 *
 * Both are driven off the SAME `metaRef`, which is what stops the live roster
 * and the visit history ever telling the admin two different stories about the
 * same session. The database write is fire-and-forget and swallows its own
 * failures (see `@/data/visits`): a shopper's page must never break, or slow
 * down, because analytics had a bad minute.
 */
export function PresenceTracker() {
  const location = useLocation();
  const { profile } = useAuth();
  const { guest } = useShop();

  // A seller should appear in the admin's live roster by their *boutique* name,
  // not their personal owner name. Their own tab is the only one that can read
  // their boutique, so resolve it here and broadcast it as the presence name.
  // Non-sellers never hit the query.
  const isSeller = profile?.role === 'seller';
  const { data: boutique } = useAsync(
    () => (isSeller && profile ? fetchMyBoutique(profile.id) : Promise.resolve(null)),
    [isSeller, profile?.id],
  );

  const handle = useRef<PresenceHandle | null>(null);
  // Approximate, IP-based location (city-level), resolved once from /api/geo.
  const locationRef = useRef<string>('');
  const metaRef = useRef<PresenceMeta>({
    id: presenceId(),
    name: 'Guest',
    role: 'guest',
    page: 'Browsing',
    section: 'buyer',
    path: location.pathname,
    at: new Date().toISOString(),
  });

  // Recompute the state blob on every render so update() always tracks fresh
  // name/role/page. `at` is only bumped on real activity (navigation / beat).
  const { page, section } = describePage(location.pathname);
  metaRef.current = {
    ...metaRef.current,
    id: presenceId(),
    name: isSeller
      ? (boutique?.name?.trim() || profile?.full_name?.trim() || 'Boutique')
      : (profile?.full_name?.trim() || guest.name?.trim() || 'Guest'),
    role: (profile?.role as PresenceRole) ?? 'guest',
    page,
    section,
    path: location.pathname,
    location: locationRef.current || undefined,
  };

  // Join once; leave on unmount (tab close also clears presence server-side).
  useEffect(() => {
    handle.current = joinPresence(() => metaRef.current);
    return () => handle.current?.leave();
  }, []);

  // Resolve this tab's location once, then re-announce it. Tries GPS for the
  // real area and falls back to IP; either way it's best-effort, so a failure
  // (denied, offline, local dev) just leaves the location unset.
  useEffect(() => {
    let cancelled = false;
    void resolveLocation().then((label) => {
      if (cancelled || !label) return;
      locationRef.current = label;
      metaRef.current.location = label;
      // A full beat, not just a presence update: geolocation resolves seconds
      // after the visit row was inserted, so this is the only chance the stored
      // visit gets to learn where it came from.
      beatRef.current();
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // One beat = announce on Realtime AND extend the durable visit record. Every
  // trigger below goes through here so the two can never drift apart.
  const beat = () => {
    const m = metaRef.current;
    m.at = new Date().toISOString();
    handle.current?.update();
    void recordVisitBeat({
      visitId: m.id,
      role: m.role,
      name: m.name,
      location: m.location ?? '',
      path: m.path,
      label: m.page,
      section: m.section,
    });
  };
  const beatRef = useRef(beat);
  beatRef.current = beat;

  // Re-track whenever the page or the signed-in identity changes. On a route
  // change this is also what closes the previous page's dwell timer: the server
  // sees a different path and freezes the row it had open.
  useEffect(() => {
    beatRef.current();
  }, [location.pathname, profile?.id, profile?.full_name, guest.name, boutique?.name]);

  // Heartbeat: keep "last active" fresh while a tab sits on one page, and
  // re-announce the moment the tab is refocused.
  //
  // 45s is a presence-shaped interval — plenty for an "active 2m ago" label.
  // It is also the resolution of the LAST page's dwell time, since no
  // navigation ever arrives to close it, which is why `pagehide` fires a final
  // beat below. Every earlier page in the visit is exact regardless.
  useEffect(() => {
    const tick = () => beatRef.current();
    const timer = window.setInterval(tick, 45000);
    const onVisible = () => document.visibilityState === 'visible' && tick();
    // The closing beat. `pagehide` is the one event that fires reliably on
    // mobile Safari, where a backgrounded tab is frozen and killed without ever
    // seeing `beforeunload`; `visibilitychange → hidden` covers the tab-switch
    // case. Without them the final page of every visit would report whatever
    // the last 45s tick happened to catch.
    const onLeaving = () => {
      if (document.visibilityState === 'hidden') beatRef.current();
    };
    document.addEventListener('visibilitychange', onVisible);
    document.addEventListener('visibilitychange', onLeaving);
    window.addEventListener('pagehide', tick);
    window.addEventListener('focus', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      document.removeEventListener('visibilitychange', onLeaving);
      window.removeEventListener('pagehide', tick);
      window.removeEventListener('focus', onVisible);
    };
  }, []);

  return null;
}
