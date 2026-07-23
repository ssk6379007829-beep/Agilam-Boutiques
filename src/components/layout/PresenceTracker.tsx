import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { useShop } from '@/state/ShopContext';
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
  const handle = useRef<PresenceHandle | null>(null);
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
    name: (profile?.full_name?.trim() || guest.name?.trim() || 'Guest'),
    role: (profile?.role as PresenceRole) ?? 'guest',
    page,
    section,
    path: location.pathname,
  };

  // Join once; leave on unmount (tab close also clears presence server-side).
  useEffect(() => {
    handle.current = joinPresence(() => metaRef.current);
    return () => handle.current?.leave();
  }, []);

  // Re-track whenever the page or the signed-in identity changes.
  useEffect(() => {
    metaRef.current.at = new Date().toISOString();
    handle.current?.update();
  }, [location.pathname, profile?.id, profile?.full_name, guest.name]);

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
