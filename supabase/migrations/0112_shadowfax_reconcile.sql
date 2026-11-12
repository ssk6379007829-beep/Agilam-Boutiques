-- Shadowfax: buyer coordinates, and the sweep that stops a dropped callback
-- costing a seller their payout.
--
-- Apply AFTER 0110.
--
-- ── WHY THE SWEEP IS NOT OPTIONAL ───────────────────────────────────────────
-- Shadowfax do not retry callbacks. Their words: "a failed callback delivery is
-- not retried. Use Tracking to reconcile anything your endpoint missed." So one
-- dropped POST — a cold start past their 10-second timeout, a deploy, a blip —
-- loses that event forever. If the lost event was `delivered`, the order never
-- reaches 'delivered', never becomes settleable by is_settleable(), and the
-- seller is simply never paid. No console would show why.
--
-- This is the reverse of the Shiprocket arrangement, where the webhook retries
-- indefinitely and a sweep would be a nicety. Here the sweep is the system of
-- record and the callback is what makes it feel live.

-- Buyer coordinates are NOT added here. They would only serve Shadowfax's
-- hyperlocal product, which is out of scope for v1 (it routes on lat/long and
-- checkout collects none), and a column nothing reads is a column that drifts.
-- They belong in the same migration as the checkout change that fills them.

-- ── The sweep ───────────────────────────────────────────────────────────────
-- Every 30 minutes. Surface parcels move over days, so this is frequent enough
-- to keep a payout within an hour of its scan without hammering their API —
-- and bulk_track carries 50 AWBs per call, so a sweep is a handful of requests.

select cron.unschedule('shadowfax-reconcile')
where exists (select 1 from cron.job where jobname = 'shadowfax-reconcile');

-- timeout_milliseconds is NOT decoration. pg_net defaults to FIVE SECONDS, and
-- a sweep that bulk-tracks several batches and replays their timelines takes
-- longer than that. The daily-report job was cut off at the default on its very
-- first run (0094) and failed silently for six days; do not repeat it.
select cron.schedule('shadowfax-reconcile', '*/30 * * * *', $job$
  select net.http_post(
    url                  := 'https://mtxmuaskmyhnqczctwlp.supabase.co/functions/v1/shadowfax-reconcile',
    headers              := '{"x-cron-key":"<RECONCILE_TOKEN>","Content-Type":"application/json"}'::jsonb,
    body                 := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$job$);

-- ─────────────────────────────────────────────────────────────────────────────
--  DID YOU ACTUALLY REPLACE THE TOKEN?
--
--  This guard exists because 0094 shipped with its placeholder left as literal
--  text. pg_cron dutifully posted it every morning, the function rejected it
--  401 before touching the database, and nothing recorded the failure — pg_cron
--  only sees that net.http_post returned a request id, which it always does.
--  The cloud sender was dead for six days before anyone noticed.
--
--  The same silence would be worse here: a dead sweep looks exactly like a
--  healthy one right up until a seller asks why they have not been paid.
--
--  So make it loud. This raises, and because cron.schedule() is an ordinary
--  transactional insert, the raise rolls the registration back — an error
--  instead of a job that is registered and permanently useless.
--
--  The placeholder is built by concatenation on purpose: written literally, a
--  find-and-replace across this file would substitute it too, and the check
--  would pass while testing nothing.
-- ─────────────────────────────────────────────────────────────────────────────

do $do$
declare
  v_command     text;
  v_placeholder text := '<' || 'RECONCILE_TOKEN' || '>';
begin
  select command into v_command from cron.job where jobname = 'shadowfax-reconcile';

  if v_command is null then
    raise exception 'shadowfax-reconcile is not registered — cron.schedule() above did not take.';
  end if;

  if position(v_placeholder in v_command) > 0 then
    raise exception using
      message = 'shadowfax-reconcile was scheduled with the token placeholder still in it.',
      hint    = 'Replace <RECONCILE_TOKEN> in this file with the real SHADOWFAX_RECONCILE_TOKEN secret, then run it again.';
  end if;
end
$do$;
