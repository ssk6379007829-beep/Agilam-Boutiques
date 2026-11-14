-- Schedule the DTDC reconcile sweep, reading its token from Vault.
--
-- Apply AFTER 0113 (require_cron_secret) and 0114 (the dtdc provider). Refuses
-- to run until both are in place and the Vault secret exists — scheduling a job
-- whose secret does not resolve is exactly the silent 401 that 0113 removed.
--
-- WHY A SWEEP AT ALL
-- The DTDC status webhook is configured on THEIR side, on request, and until
-- that is done `dtdc-tracking` receives nothing. Even once it is live a dropped
-- callback may never be retried. If the lost event was `delivered`, the order
-- never becomes settleable and the seller is never paid — with nothing in any
-- console to explain why. The sweep is the system of record; the webhook, when
-- it comes, only makes it feel live.
--
-- Before applying, ONCE, in the SQL editor with the real value (the same string
-- set as the DTDC_RECONCILE_TOKEN secret on the Edge Function):
--
--   select vault.create_secret('<DTDC_RECONCILE_TOKEN>', 'dtdc_reconcile_token');

-- ── Preconditions ───────────────────────────────────────────────────────────

do $do$
begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'require_cron_secret'
  ) then
    raise exception using
      message = 'public.require_cron_secret() does not exist — apply 0113_cron_secrets_from_vault.sql first.',
      hint    = 'It is the Vault-reading helper every scheduled job here uses.';
  end if;

  if not exists (
    select 1 from pg_constraint c
    where c.conname = 'shipments_provider_check'
      and pg_get_constraintdef(c.oid) like '%''dtdc''%'
  ) then
    raise exception using
      message = 'shipments.provider does not admit ''dtdc'' — apply 0114_dtdc.sql first.';
  end if;

  if not exists (select 1 from vault.secrets where name = 'dtdc_reconcile_token') then
    raise exception using
      message = 'Vault is missing the secret dtdc_reconcile_token.',
      hint    = 'Create it with: select vault.create_secret(''<value>'', ''dtdc_reconcile_token''); then run this file again.';
  end if;
end
$do$;

-- ── dtdc-reconcile ──────────────────────────────────────────────────────────
-- Every 30 minutes, offset from shadowfax-reconcile so the two sweeps do not
-- land on the same tick. One GET per in-flight parcel (the customer API has no
-- bulk form), capped at 150 a run inside the function.

select cron.unschedule('dtdc-reconcile')
where exists (select 1 from cron.job where jobname = 'dtdc-reconcile');

-- timeout_milliseconds is NOT decoration. pg_net defaults to FIVE SECONDS and a
-- sweep of 150 sequential tracking calls takes far longer.
select cron.schedule('dtdc-reconcile', '15,45 * * * *', $job$
  select net.http_post(
    url                  := 'https://mtxmuaskmyhnqczctwlp.supabase.co/functions/v1/dtdc-reconcile',
    headers              := jsonb_build_object(
                              'x-cron-key',   public.require_cron_secret('dtdc_reconcile_token'),
                              'Content-Type', 'application/json'),
    body                 := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
$job$);

-- ── Prove it ────────────────────────────────────────────────────────────────
do $do$
begin
  if not exists (select 1 from cron.job where jobname = 'dtdc-reconcile') then
    raise exception 'dtdc-reconcile did not register — cron.schedule() above did not take.';
  end if;
  -- Resolve the secret the way the job will, so a wrong NAME is caught now
  -- rather than at the next quarter hour. The value is discarded.
  perform public.require_cron_secret('dtdc_reconcile_token');
end
$do$;
