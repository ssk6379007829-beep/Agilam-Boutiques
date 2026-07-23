import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { useShop } from '@/state/ShopContext';
import { useAsync } from '@/hooks/useAsync';
import { fetchMyBoutique } from '@/data/boutiques';
import { resolveLocation } from '@/lib/geolocate';
import { joinPresence, presenceId, describePage, type PresenceHandle, type PresenceMeta, type PresenceRole } from '@/lib/presence';

/**
 * Broadcasts this tab's live presence to the shared site channel so the admin
 * console can see who is currently on the site and what they're doing. Mounted
 * once, app-wide (App.tsx), inside the auth + shop providers. Renders nothing.
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
      handle.current?.update();
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Re-track whenever the page or the signed-in identity changes.
  useEffect(() => {
    metaRef.current.at = new Date().toISOString();
    handle.current?.update();
  }, [location.pathname, profile?.id, profile?.full_name, guest.name, boutique?.name]);

  // Heartbeat: keep "last active" fresh while a tab sits on one page, and
  // re-announce the moment the tab is refocused.
  useEffect(() => {
    const beat = () => {
      metaRef.current.at = new Date().toISOString();
      handle.current?.update();
    };
    const timer = window.setInterval(beat, 45000);
    const onVisible = () => document.visibilityState === 'visible' && beat();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, []);

  return null;
}
