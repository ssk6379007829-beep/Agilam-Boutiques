/**
 * Replay any DTDC scans our webhook missed — or never received.
 *
 * WHY THIS EXISTS AND IS NOT OPTIONAL
 * The DTDC status webhook is configured by DTDC/Shipsy on their side, on
 * request, and until that is done nothing arrives at `dtdc-tracking` at all.
 * Even once it is live, a dropped POST — a cold start, a deploy, a blip — may
 * never be retried. If the lost event was `delivered`, the order never reaches
 * `delivered`, never satisfies is_settleable(), and the seller is never paid,
 * with nothing in any console to explain why.
 *
 * So this sweep runs every 30 minutes (migration 0115, pg_cron + Vault) and is
 * the system of record. The webhook, when it comes, only makes it feel live.
 *
 * Everything goes through apply_shipment_scan() (0067), which is idempotent —
 * the unique index on (shipment_id, raw_status, occurred_at) plus
 * `on conflict do nothing` means replaying a scan we already have is free.
 *
 * The customer tracking API has no bulk form, so this is one GET per parcel.
 * Capped at 150 parcels a run; at 30-minute intervals that is far more than
 * this marketplace has in flight, and the oldest are swept first so nothing
 * starves.
 */

import { json, safeEqual, serviceClient } from '../_shared/courier.ts';
import { DtdcError, mapEventStage, track } from '../_shared/dtdc.ts';

/** Parcels in these stages are finished; nothing further will be scanned. */
const TERMINAL = ['delivered', 'rto'];

/** A parcel older than this that is still in flight is a support problem, not
 *  a reconciliation one, and sweeping it forever would grow this job without
 *  bound. */
const LOOKBACK_DAYS = 45;
const MAX_PER_RUN = 150;

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // Invoked by pg_cron, not a browser. A shared token keeps it off the open
  // internet; an unset token refuses everything rather than running wide open.
  const expected = Deno.env.get('DTDC_RECONCILE_TOKEN') ?? '';
  if (!expected) {
    console.error('DTDC_RECONCILE_TOKEN is not set — refusing to run');
    return json({ error: 'Reconciliation not configured' }, 503);
  }
  const presented = req.headers.get('x-cron-key') ?? '';
  if (!safeEqual(presented, expected)) return json({ error: 'Unauthorized' }, 401);

  const db = serviceClient();
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86400000).toISOString();

  const { data: open, error } = await db
    .from('shipments')
    .select('awb, last_status')
    .eq('provider', 'dtdc')
    .gte('shipped_at', since)
    .order('shipped_at', { ascending: true })
    .limit(500);

  if (error) {
    console.error('dtdc-reconcile: could not list shipments', error.message);
    return json({ error: error.message }, 500);
  }

  const awbs = (open ?? [])
    .filter((s) => !TERMINAL.includes(String(s.last_status ?? '')))
    .map((s) => String(s.awb))
    .filter(Boolean)
    .slice(0, MAX_PER_RUN);

  if (awbs.length === 0) return json({ ok: true, checked: 0, applied: 0 });

  let applied = 0;
  let checked = 0;
  const problems: string[] = [];

  for (const awb of awbs) {
    checked += 1;
    let result;
    try {
      result = await track(awb);
    } catch (e) {
      // One bad parcel must not abandon the rest. A 400 "Consignment not
      // found" here is itself information — the booking may have been
      // cancelled from the DTDC portal — so it is reported, not swallowed.
      const msg = e instanceof DtdcError ? e.message : (e as Error).message;
      console.error('dtdc track failed', { awb, error: msg });
      problems.push(`${awb}: ${msg}`);
      // Credentials or an outage affect every parcel: stop rather than log the
      // same failure 150 times.
      if (e instanceof DtdcError && (e.status === 401 || e.status === 403 || e.status >= 500)) break;
      continue;
    }

    // Chronological, so a replay rebuilds the timeline in the right order and
    // `delivered` lands last.
    const ordered = [...result.events].sort((a, b) =>
      String(a.occurredAt ?? '').localeCompare(String(b.occurredAt ?? '')));

    for (const ev of ordered) {
      const stage = mapEventStage(ev.type);
      if (stage === null) continue;

      const { data, error: rpcErr } = await db.rpc('apply_shipment_scan', {
        p_awb: awb,
        p_raw_status: ev.failureReason ? `${ev.text} — ${ev.failureReason}` : ev.text,
        p_stage: stage,
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

  // Logged as well as returned: pg_cron keeps the HTTP response, but nobody
  // reads cron.job_run_details until something is already wrong.
  console.log('dtdc-reconcile done', { checked, applied, problems: problems.length });
  return json({ ok: true, checked, applied, problems: problems.slice(0, 10) });
});
