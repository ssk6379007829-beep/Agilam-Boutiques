/**
 * Replay any Shadowfax scans our callback endpoint missed.
 *
 * WHY THIS EXISTS AND IS NOT OPTIONAL
 * Shadowfax do not retry callbacks: "a failed callback delivery is not retried.
 * Use Tracking to reconcile anything your endpoint missed." So a single dropped
 * POST — our function cold-starting past their 10-second timeout, a deploy, a
 * network blip — loses that event permanently. If the lost event was
 * `delivered`, the order never reaches `delivered`, never becomes settleable,
 * and the seller is never paid. Nothing in any console would explain why.
 *
 * This sweep is therefore the system of record, and the callback is an
 * optimisation that makes it feel live. That is the opposite of the Shiprocket
 * arrangement, and it is their design, not a choice of ours.
 *
 * Everything goes through apply_shipment_scan() (0067), which is idempotent —
 * 0067's unique index on (shipment_id, raw_status, occurred_at) plus
 * `on conflict do nothing` means replaying a scan we already have is free.
 *
 * SCOPE: surface parcels only. `bulk_track` belongs to Forward Logistics and
 * takes AWBs; hyperlocal has no AWB and only a per-order details endpoint, so
 * reconciling it would be one call per parcel. Same-day orders also resolve
 * within hours rather than days, so a missed callback there surfaces fast and
 * is far less likely to sit unnoticed. Worth revisiting if same-day volume ever
 * justifies it.
 */

import { json, safeEqual, serviceClient } from '../_shared/courier.ts';
import { bulkTrackForward, mapForwardStage } from '../_shared/shadowfax.ts';

/** Parcels in these stages are finished; nothing further will be scanned. */
const TERMINAL = ['delivered', 'rto'];

/** How far back to look. A parcel older than this that is still in flight is a
 *  support problem, not a reconciliation one, and sweeping it forever would
 *  grow this job without bound. */
const LOOKBACK_DAYS = 30;

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // Invoked by pg_cron, not a browser. A shared token keeps it off the open
  // internet; an unset token refuses everything rather than running wide open.
  const expected = Deno.env.get('SHADOWFAX_RECONCILE_TOKEN') ?? '';
  if (!expected) {
    console.error('SHADOWFAX_RECONCILE_TOKEN is not set — refusing to run');
    return json({ error: 'Reconciliation not configured' }, 503);
  }
  const presented = req.headers.get('x-cron-key') ?? '';
  if (!safeEqual(presented, expected)) return json({ error: 'Unauthorized' }, 401);

  const db = serviceClient();
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86400000).toISOString();

  // In-flight surface parcels. `last_status` is 0067's denormalised latest
  // stage, so this needs no join against shipment_events.
  const { data: open, error } = await db
    .from('shipments')
    .select('awb, last_status, service_level')
    .eq('provider', 'shadowfax')
    .eq('service_level', 'surface')
    .gte('shipped_at', since)
    .order('shipped_at', { ascending: true })
    .limit(500);

  if (error) {
    console.error('shadowfax-reconcile: could not list shipments', error.message);
    return json({ error: error.message }, 500);
  }

  const awbs = (open ?? [])
    .filter((s) => !TERMINAL.includes(String(s.last_status ?? '')))
    .map((s) => String(s.awb))
    .filter((a) => a && !a.startsWith('SFXHL-'));

  if (awbs.length === 0) return json({ ok: true, checked: 0, applied: 0 });

  let applied = 0;
  let checked = 0;
  const problems: string[] = [];

  // 50 per call is their documented maximum.
  for (let i = 0; i < awbs.length; i += 50) {
    const batch = awbs.slice(i, i + 50);
    checked += batch.length;

    let timeline: Record<string, Awaited<ReturnType<typeof bulkTrackForward>>[string]>;
    try {
      timeline = await bulkTrackForward(batch);
    } catch (e) {
      // One bad batch must not abandon the rest — the next sweep would face the
      // same wall, and a parcel stuck behind it would never settle.
      console.error('bulk_track failed for a batch', (e as Error).message);
      problems.push((e as Error).message);
      continue;
    }

    for (const [awb, events] of Object.entries(timeline)) {
      // Chronological, so a replay rebuilds the timeline in the right order and
      // `delivered` lands last.
      const ordered = [...events].sort((a, b) =>
        String(a.occurredAt ?? '').localeCompare(String(b.occurredAt ?? '')));

      for (const ev of ordered) {
        const { data, error: rpcErr } = await db.rpc('apply_shipment_scan', {
          p_awb: awb,
          p_raw_status: ev.statusText,
          p_stage: mapForwardStage(ev.statusId),
          p_location: ev.location,
          p_occurred_at: ev.occurredAt,
          p_payload: { source: 'reconcile', ...ev } as unknown as Record<string, unknown>,
        });
        if (rpcErr) {
          console.error('apply_shipment_scan failed during reconcile', { awb, error: rpcErr.message });
          problems.push(`${awb}: ${rpcErr.message}`);
          continue;
        }
        if (data !== false) applied += 1;
      }
    }
  }

  // Logged as well as returned: pg_cron keeps the HTTP response, but nobody
  // reads cron.job_run_details until something is already wrong.
  console.log('shadowfax-reconcile done', { checked, applied, problems: problems.length });
  return json({ ok: true, checked, applied, problems: problems.slice(0, 10) });
});
