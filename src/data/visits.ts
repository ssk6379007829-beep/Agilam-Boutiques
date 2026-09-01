import { supabase } from '@/lib/supabase';

/**
 * Visit history — the persisted half of "who is on our site".
 *
 * Live presence (`@/lib/presence`) answers "right now" over Realtime and keeps
 * nothing. This module answers "who came, when, and for how long" by writing to
 * the `site_visits` / `site_visit_pages` tables added in migration 0107.
 *
 * The write side is called from every tab, signed in or not, on a heartbeat —
 * so it is written to be completely unable to hurt the page it runs on: one
 * RPC, no reads, every failure swallowed. A shopper must never see a broken
 * storefront because analytics had a bad minute.
 *
 * The read side is admin-only and enforced by RLS, not by this file.
 */

/* ── Write side (runs in every visitor's browser) ─────────────────────────── */

const VISITOR_KEY = 'mm.visitor.id';

/**
 * A stable id for this BROWSER, as opposed to `presenceId()` which is per tab.
 *
 * Without it every reload would look like a brand-new person and the console
 * could only ever report visits, never visitors — "312 visits today" reads very
 * differently from "312 people today", and only one of them is true.
 *
 * localStorage can throw outright (Safari private mode, storage disabled), so
 * the whole thing is guarded and falls back to a per-session id: that visitor
 * merely counts twice, which is much better than a storefront that fails to
 * render.
 */
export function visitorId(): string {
  const fresh = () => (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2));
  try {
    const existing = localStorage.getItem(VISITOR_KEY);
    if (existing) return existing;
    const id = fresh();
    localStorage.setItem(VISITOR_KEY, id);
    return id;
  } catch {
    return fresh();
  }
}

/** Coarse device class — enough to answer "is our traffic mobile?", nothing more. */
export function deviceClass(): string {
  if (typeof navigator === 'undefined') return '';
  const ua = navigator.userAgent;
  if (/iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua)) return 'Tablet';
  if (/Mobi|Android|iPhone|iPod|IEMobile|Opera Mini/i.test(ua)) return 'Mobile';
  return 'Desktop';
}

/**
 * The referrer that brought them here, reduced to a hostname.
 *
 * Only the FIRST document of the session is an external referrer; every
 * client-side route change after that reports our own origin, which is noise.
 * Same-origin is therefore dropped rather than stored as "mangaimart.com".
 */
export function entryReferrer(): string {
  if (typeof document === 'undefined') return '';
  const raw = document.referrer;
  if (!raw) return '';
  try {
    const url = new URL(raw);
    if (url.hostname === window.location.hostname) return '';
    return url.hostname;
  } catch {
    return '';
  }
}

export interface VisitBeat {
  visitId: string;
  role: string;
  name: string;
  location: string;
  path: string;
  label: string;
  section: string;
}

/**
 * Record one beat — "this tab is on this page, now".
 *
 * The server decides whether that means a new visit, a new page, or more
 * seconds on the current one; see the note on `track_visit` in 0107. Resolves
 * regardless of outcome and never rejects.
 */
export async function recordVisitBeat(beat: VisitBeat): Promise<void> {
  try {
    await supabase.rpc('track_visit', {
      p_visit_id: beat.visitId,
      p_visitor_id: visitorId(),
      p_role: beat.role,
      p_name: beat.name,
      p_location: beat.location,
      p_path: beat.path,
      p_label: beat.label,
      p_section: beat.section,
      p_device: deviceClass(),
      p_referrer: entryReferrer(),
    });
  } catch {
    // Deliberately silent. Analytics is never worth a console error on a
    // shopper's screen, and the caller has nothing useful to do about it.
  }
}

/* ── Read side (admin console only) ───────────────────────────────────────── */

export interface VisitRow {
  id: string;
  visitor_id: string;
  user_id: string | null;
  role: string;
  name: string | null;
  location: string | null;
  device: string | null;
  referrer: string | null;
  entry_path: string | null;
  last_path: string | null;
  page_count: number;
  started_at: string;
  last_seen_at: string;
}

export interface VisitPageRow {
  id: number;
  visit_id: string;
  path: string;
  label: string | null;
  section: string | null;
  entered_at: string;
  left_at: string;
  seconds: number;
}

export interface VisitStats {
  visits: number;
  visitors: number;
  signed_in: number;
  guests: number;
  page_views: number;
  avg_seconds: number;
  avg_pages: number;
}

/** How long a visit lasted, in seconds. Derived, never stored — see 0107. */
export const visitSeconds = (v: VisitRow): number =>
  Math.max(0, Math.round((new Date(v.last_seen_at).getTime() - new Date(v.started_at).getTime()) / 1000));

/** Start of the window a range key covers. `0` days means "since midnight". */
export function sinceFor(days: number): Date {
  if (days === 0) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }
  return new Date(Date.now() - days * 86400_000);
}

export async function fetchVisits(since: Date, limit = 300): Promise<VisitRow[]> {
  const { data, error } = await supabase
    .from('site_visits')
    .select('id, visitor_id, user_id, role, name, location, device, referrer, entry_path, last_path, page_count, started_at, last_seen_at')
    .gte('started_at', since.toISOString())
    .order('started_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as VisitRow[];
}

/**
 * The per-page breakdown for ONE visit, loaded when a row is expanded rather
 * than with the list: a busy day is a few hundred visits and several thousand
 * page rows, and nobody reads more than one visit's trail at a time.
 */
export async function fetchVisitPages(visitId: string): Promise<VisitPageRow[]> {
  const { data, error } = await supabase
    .from('site_visit_pages')
    .select('id, visit_id, path, label, section, entered_at, left_at, seconds')
    .eq('visit_id', visitId)
    .order('entered_at', { ascending: true })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as VisitPageRow[];
}

/** Totals over the window, counted in Postgres so they stay right at any volume. */
export async function fetchVisitStats(since: Date): Promise<VisitStats> {
  const { data, error } = await supabase.rpc('visit_stats', { p_since: since.toISOString() });
  if (error) throw error;
  // The RPC returns a one-row table, which supabase-js hands back as an array.
  const row = (Array.isArray(data) ? data[0] : data) as VisitStats | undefined;
  return {
    visits: Number(row?.visits ?? 0),
    visitors: Number(row?.visitors ?? 0),
    signed_in: Number(row?.signed_in ?? 0),
    guests: Number(row?.guests ?? 0),
    page_views: Number(row?.page_views ?? 0),
    avg_seconds: Number(row?.avg_seconds ?? 0),
    avg_pages: Number(row?.avg_pages ?? 0),
  };
}

export interface TopPage {
  label: string;
  path: string;
  views: number;
  totalSeconds: number;
}

/**
 * The pages that actually held attention over the window.
 *
 * Aggregated in the browser from a capped slice rather than in SQL: the answer
 * is a ranking, so it stays useful even when the slice is only the most recent
 * few thousand rows, and it saves a second database function that would have to
 * be kept in step with this one.
 */
export async function fetchTopPages(since: Date, limit = 8): Promise<TopPage[]> {
  const { data, error } = await supabase
    .from('site_visit_pages')
    .select('path, label, seconds')
    .gte('entered_at', since.toISOString())
    .order('entered_at', { ascending: false })
    .limit(4000);
  if (error) throw error;

  const buckets = new Map<string, TopPage>();
  (data ?? []).forEach((r) => {
    const row = r as { path: string; label: string | null; seconds: number };
    const key = row.path;
    const found = buckets.get(key) ?? { label: row.label || 'Browsing', path: key, views: 0, totalSeconds: 0 };
    found.views += 1;
    found.totalSeconds += Number(row.seconds ?? 0);
    buckets.set(key, found);
  });

  return [...buckets.values()].sort((a, b) => b.views - a.views).slice(0, limit);
}
