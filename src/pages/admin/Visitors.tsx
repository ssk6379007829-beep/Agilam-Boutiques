import { useMemo, useState } from 'react';
import { css } from '@/lib/css';
import { useAsync } from '@/hooks/useAsync';
import { Avatar, EmptyState, Icon, SearchInput, StatCard, TabBar, T } from '@/components/admin/kit';
import { LivePresence } from '@/pages/admin/LivePresence';
import {
  fetchTopPages,
  fetchVisitPages,
  fetchVisitStats,
  fetchVisits,
  sinceFor,
  visitSeconds,
  type VisitRow,
} from '@/data/visits';

/**
 * Visitors — who is on the site now, and who has been.
 *
 * Two halves that answer two different questions, and the split is the whole
 * point of the screen:
 *
 *   • The live panel at the top is Realtime presence. It knows about open tabs
 *     and nothing else, and it is instant.
 *   • Everything below it is the `site_visits` history from migration 0107. It
 *     knows about tabs that closed weeks ago, and it is a query.
 *
 * They are never merged into one list. A visitor who is online right now
 * appears in both — once as a live session, once as a visit still being written
 * to — and stitching those together would mean inventing a reconciliation rule
 * that would be wrong the moment someone's connection dropped.
 */

const RANGES = [
  { key: 'today', label: 'Today', days: 0 },
  { key: 'week', label: 'Last 7 days', days: 7 },
  { key: 'month', label: 'Last 30 days', days: 30 },
] as const;

type RangeKey = (typeof RANGES)[number]['key'];

const ROLE_LABEL: Record<string, string> = {
  guest: 'Guest',
  buyer: 'Buyer',
  seller: 'Seller',
  admin: 'Admin',
  staff: 'Staff',
};

/** Compact duration for a table cell — "4m 12s", "1h 03m". */
function shortDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

/** Wall-clock time, plus the day when the range can span more than one. */
function clock(iso: string, withDay: boolean): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
  if (!withDay) return time;
  return `${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, ${time}`;
}

const deviceIcon = (device: string | null): string => {
  if (device === 'Mobile') return 'smartphone';
  if (device === 'Tablet') return 'tablet_mac';
  return 'computer';
};

export function Visitors() {
  const [range, setRange] = useState<RangeKey>('today');
  const [q, setQ] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const days = RANGES.find((r) => r.key === range)!.days;
  // A new Date on every render would be a new dep on every render, so the
  // window is pinned to the range key and only moves when the admin does.
  const since = useMemo(() => sinceFor(days), [days]);
  const multiDay = days > 0;

  const { data: stats } = useAsync(() => fetchVisitStats(since), [since.getTime()]);
  const { data: visits, loading } = useAsync(() => fetchVisits(since), [since.getTime()]);
  const { data: topPages } = useAsync(() => fetchTopPages(since), [since.getTime()]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = visits ?? [];
    if (!needle) return list;
    return list.filter((v) =>
      (v.name ?? '').toLowerCase().includes(needle) ||
      (v.location ?? '').toLowerCase().includes(needle) ||
      (v.last_path ?? '').toLowerCase().includes(needle) ||
      (v.entry_path ?? '').toLowerCase().includes(needle) ||
      (v.referrer ?? '').toLowerCase().includes(needle) ||
      v.role.toLowerCase().includes(needle),
    );
  }, [visits, q]);

  return (
    <div style={css('display:flex;flex-direction:column;gap:16px;')}>
      {/* Who is here this second. Its own system — see the module note. */}
      <LivePresence />

      <TabBar tabs={RANGES.map((r) => ({ key: r.key, label: r.label }))} value={range} onChange={setRange} />

      <div style={css('display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px;')}>
        <StatCard
          label="Visits"
          value={String(stats?.visits ?? 0)}
          icon="ads_click"
          tint="var(--ag-surface-2)"
          ic="#D6336C"
          sub={`${stats?.avg_pages ?? 0} pages avg`}
        />
        {/* Visits and visitors are deliberately two tiles: one browser opening
            the site six times is 6 visits and 1 visitor, and reporting only the
            first number is how a quiet day looks busy. */}
        <StatCard
          label="Unique visitors"
          value={String(stats?.visitors ?? 0)}
          icon="group"
          tint="var(--ag-info-bg)"
          ic="var(--ag-info-text)"
          sub={`${stats?.signed_in ?? 0} signed in`}
        />
        <StatCard
          label="Avg time on site"
          value={shortDuration(stats?.avg_seconds ?? 0)}
          icon="schedule"
          tint="var(--ag-purple-bg)"
          ic="#9B7FC7"
        />
        <StatCard
          label="Page views"
          value={String(stats?.page_views ?? 0)}
          icon="visibility"
          tint="var(--ag-surface-2)"
          ic="#B02454"
          sub={`${stats?.guests ?? 0} guest visits`}
        />
      </div>

      {topPages && topPages.length > 0 && (
        <div style={css(T.card + 'padding:20px;')}>
          <div style={css('font-weight:800;font-size:14.5px;margin-bottom:14px;')}>Where the time went</div>
          <div style={css('display:flex;flex-direction:column;gap:10px;')}>
            {topPages.map((p) => {
              const busiest = topPages[0].views || 1;
              return (
                <div key={p.path} style={css('display:flex;align-items:center;gap:12px;')}>
                  <div style={css('flex:1;min-width:0;')}>
                    <div style={css('font-size:13px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;')}>{p.label}</div>
                    <div style={css(`font-size:11.5px;color:${T.muted};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;`)}>{p.path}</div>
                    <div style={css('height:6px;border-radius:3px;background:var(--ag-surface-2);margin-top:6px;overflow:hidden;')}>
                      <div style={css(`height:100%;border-radius:3px;background:linear-gradient(90deg,#E7719F,#D6336C);width:${Math.max(4, Math.round((p.views / busiest) * 100))}%;`)} />
                    </div>
                  </div>
                  <div style={css('flex:none;text-align:right;')}>
                    <div style={css('font-size:13px;font-weight:800;')}>{p.views}</div>
                    {/* Total dwell divided by views: "how long does this page
                        actually hold someone", which is the number that says
                        whether a product page is working. */}
                    <div style={css(`font-size:11.5px;color:${T.muted};`)}>{shortDuration(p.totalSeconds / Math.max(1, p.views))} avg</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <SearchInput value={q} onChange={setQ} placeholder="Search by name, place, page or referrer…" />

      <div style={css(T.card + 'padding:20px;')}>
        <div style={css('display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap;')}>
          <div style={css('font-weight:800;font-size:14.5px;')}>Visit history</div>
          <div style={css(`font-size:12px;color:${T.muted};font-weight:600;`)}>
            {rows.length} visit{rows.length === 1 ? '' : 's'} · newest first
          </div>
        </div>

        {loading && !visits ? (
          <div style={css(`color:${T.muted};font-size:13.5px;`)}>Loading visits…</div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon="travel_explore"
            title={q ? 'No matching visits' : 'No visits recorded in this window'}
            sub={q ? 'Try a different name, place or page.' : 'Every visit from now on is recorded here, guests included.'}
          />
        ) : (
          <div style={css('display:flex;flex-direction:column;')}>
            {rows.map((v) => (
              <VisitLine
                key={v.id}
                visit={v}
                multiDay={multiDay}
                open={expanded === v.id}
                onToggle={() => setExpanded((cur) => (cur === v.id ? null : v.id))}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * One visit, collapsed to a line. Expanding it loads that visit's page trail —
 * on demand, because a busy day is a few hundred visits and several thousand
 * page rows, and nobody reads more than one trail at a time.
 */
function VisitLine({
  visit, multiDay, open, onToggle,
}: {
  visit: VisitRow;
  multiDay: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const name = visit.name?.trim() || 'Guest';
  const seconds = visitSeconds(visit);

  return (
    <div style={css(`border-bottom:1px solid ${T.border};`)}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        style={css('width:100%;display:flex;align-items:center;gap:12px;padding:12px 2px;background:none;border:none;cursor:pointer;text-align:left;font-family:inherit;color:inherit;')}
      >
        <Avatar name={name} tone={name.charCodeAt(0) % 8} />

        <div style={css('flex:1;min-width:0;')}>
          <div style={css('display:flex;align-items:center;gap:7px;flex-wrap:wrap;')}>
            <span style={css('font-weight:700;font-size:13.5px;')}>{name}</span>
            <span style={css(`font-size:10.5px;font-weight:800;padding:2px 7px;border-radius:7px;background:var(--ag-surface-2);color:${T.muted};`)}>
              {ROLE_LABEL[visit.role] ?? visit.role}
            </span>
            {visit.location && (
              <span style={css(`display:inline-flex;align-items:center;gap:3px;font-size:11.5px;color:${T.muted};`)}>
                <Icon name="location_on" size={13} color="var(--ag-muted-soft)" />
                {visit.location}
              </span>
            )}
            <span style={css(`display:inline-flex;align-items:center;gap:3px;font-size:11.5px;color:${T.muted};`)}>
              <Icon name={deviceIcon(visit.device)} size={13} color="var(--ag-muted-soft)" />
              {visit.device ?? 'Unknown'}
            </span>
          </div>
          <div style={css(`font-size:11.5px;color:${T.muted};margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;`)}>
            landed {clock(visit.started_at, multiDay)} on {visit.entry_path || '/'}
            {visit.referrer ? ` · from ${visit.referrer}` : ''}
          </div>
        </div>

        <div style={css('flex:none;text-align:right;')}>
          <div style={css('font-size:13px;font-weight:800;')}>{shortDuration(seconds)}</div>
          <div style={css(`font-size:11.5px;color:${T.muted};`)}>{visit.page_count} page{visit.page_count === 1 ? '' : 's'}</div>
        </div>

        <Icon name={open ? 'expand_less' : 'expand_more'} size={20} color="var(--ag-muted-soft)" />
      </button>

      {open && <VisitTrail visitId={visit.id} multiDay={multiDay} />}
    </div>
  );
}

/** The per-page breakdown: what they looked at, in order, and for how long. */
function VisitTrail({ visitId, multiDay }: { visitId: string; multiDay: boolean }) {
  // `live: false` — a closed visit never changes, and an open one is already
  // covered by the live panel above. Polling it would only fight the admin's
  // scroll position for no new information.
  const { data, loading } = useAsync(() => fetchVisitPages(visitId), [visitId], { live: false });

  if (loading && !data) {
    return <div style={css(`padding:4px 0 14px 56px;font-size:12.5px;color:${T.muted};`)}>Loading pages…</div>;
  }
  if (!data || data.length === 0) {
    return <div style={css(`padding:4px 0 14px 56px;font-size:12.5px;color:${T.muted};`)}>No page detail recorded for this visit.</div>;
  }

  const longest = Math.max(...data.map((p) => p.seconds), 1);

  return (
    <div style={css('padding:2px 0 16px 56px;display:flex;flex-direction:column;gap:8px;')}>
      {data.map((p, i) => (
        <div key={p.id} style={css('display:flex;align-items:center;gap:11px;')}>
          <span style={css(`flex:none;width:20px;font-size:11px;font-weight:800;color:${T.muted};`)}>{i + 1}</span>
          <div style={css('flex:1;min-width:0;')}>
            <div style={css('font-size:12.5px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;')}>
              {p.label || 'Browsing'}
            </div>
            <div style={css(`font-size:11px;color:${T.muted};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;`)}>{p.path}</div>
          </div>
          <div style={css('flex:none;width:110px;')}>
            <div style={css('height:6px;border-radius:3px;background:var(--ag-surface-2);overflow:hidden;')}>
              <div style={css(`height:100%;border-radius:3px;background:linear-gradient(90deg,#E7719F,#D6336C);width:${Math.max(4, Math.round((p.seconds / longest) * 100))}%;`)} />
            </div>
          </div>
          <div style={css('flex:none;width:66px;text-align:right;font-size:12px;font-weight:800;')}>{shortDuration(p.seconds)}</div>
          <div style={css(`flex:none;width:${multiDay ? 108 : 68}px;text-align:right;font-size:11px;color:${T.muted};`)}>{clock(p.entered_at, multiDay)}</div>
        </div>
      ))}
    </div>
  );
}
