-- Scheduled jobs read their tokens from Vault instead of having them pasted in
-- by hand.
--
-- Apply AFTER 0094 and 0112. Supersedes the `cron.schedule` blocks in both:
-- this file re-registers the same two jobs, so whichever of them is currently
-- live is replaced.
--
-- ── WHY ─────────────────────────────────────────────────────────────────────
-- 0094 and 0112 each carried a literal `<TOKEN>` placeholder that a human had
-- to replace in the SQL editor before running. That is not a theoretical
-- hazard: 0094 WAS run with its placeholder intact. pg_cron posted the string
-- "<REPORT_TOKEN>" as a bearer token every morning, the Edge Function rejected
-- it 401 before touching the database, and nothing recorded the failure —
-- pg_cron only sees that net.http_post returned a request id, which it always
-- does. The cloud sender was dead for six days. The Windows fallback task was
-- quietly covering for it, which is why no one noticed.
--
-- Both files then grew a guard that raises if the placeholder survived. The
-- guard works, but it is a seatbelt on a step that should not exist: the
-- migration still cannot be committed with a real token in it, still cannot be
-- re-run from the repo as-is, and still puts the secret in plaintext inside
-- cron.job.command, where anyone who can read that table can read the token.
--
-- Vault removes the step. The secret is inserted ONCE, outside any migration,
-- and the job reads it at execution time.
--
-- ── WHY A HELPER RATHER THAN AN INLINE SUBQUERY ─────────────────────────────
-- The obvious form is a subquery straight into jsonb_build_object. It has the
-- original bug in a new costume: a missing or renamed secret makes the subquery
-- return NULL, jsonb_build_object happily builds a header with a null value,
-- the POST goes out unauthenticated and the function 401s — silently, forever,
-- exactly as before.
--
-- require_cron_secret() raises instead. A missing secret then fails the JOB,
-- and pg_cron records failed jobs in cron.job_run_details with the message. The
-- failure becomes something you can see rather than something you deduce from a
-- seller asking why they have not been paid.

-- ── Preconditions ───────────────────────────────────────────────────────────

do $do$
begin
  if not exists (select 1 from pg_extension where extname = 'supabase_vault') then
    raise exception using
      message = 'The supabase_vault extension is not enabled on this project.',
      hint    = 'Enable it under Database → Extensions (or: create extension supabase_vault with schema vault;), then run this file again.';
  end if;
end
$do$;

-- ── The helper ──────────────────────────────────────────────────────────────

-- SECURITY INVOKER on purpose — the default, stated here because it is the
-- whole security story. A SECURITY DEFINER version owned by postgres would let
-- ANY caller read any Vault secret by name, which is a credential-exfiltration
-- primitive reachable from PostgREST. Left as invoker, the function can only
-- see what the CALLING role could already have selected for itself: pg_cron
-- runs the job as its owner, who can read Vault; anon simply gets a permission
-- error on the view.
create or replace function public.require_cron_secret(p_name text)
returns text
language plpgsql
stable
as $fn$
declare
  v_secret text;
begin
  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = p_name;

  -- Empty is as broken as absent and fails the same silent way, so both raise.
  if v_secret is null or length(trim(v_secret)) = 0 then
    raise exception 'Vault secret % is missing or empty — the scheduled job that needs it cannot authenticate.', p_name
      using hint = 'Add it with: select vault.create_secret(''<value>'', ''' || p_name || ''');';
  end if;

  return v_secret;
end
$fn$;

comment on function public.require_cron_secret(text) is
  'Reads a Vault secret for a pg_cron job and RAISES if it is absent or empty, so a misconfigured job fails loudly in cron.job_run_details rather than posting an unauthenticated request forever. Not for use in RLS policies.';

-- CLAUDE.md rule 7: a policy calling a helper that anon cannot EXECUTE makes
-- the whole anonymous read fail 42501 rather than return fewer rows (see 0086
-- and 0087). That is not a risk here — this function is called only from
-- cron.job commands, never from a policy — but the revoke is why it must stay
-- that way. Do not reference it from a policy.
revoke all on function public.require_cron_secret(text) from public;
revoke all on function public.require_cron_secret(text) from anon, authenticated;

-- ── The secrets ─────────────────────────────────────────────────────────────
-- NOT created here. A migration carrying the value is the problem this file
-- exists to remove. Run these ONCE in the SQL editor, with the real values, and
-- do not commit them:
--
--   select vault.create_secret('<SHADOWFAX_RECONCILE_TOKEN>', 'shadowfax_reconcile_token');
--   select vault.create_secret('<REPORT_TOKEN>',              'daily_report_token');
--
-- To rotate either one later, update the secret — the jobs below pick the new
-- value up on their next run with no re-scheduling:
--
--   select vault.update_secret(id, '<new value>') from vault.secrets where name = 'shadowfax_reconcile_token';
--
-- The names must match the strings below exactly. They are checked at the
-- bottom of this file before anything is scheduled.

do $do$
declare
  v_missing text[] := '{}';
begin
  if not exists (select 1 from vault.secrets where name = 'shadowfax_reconcile_token') then
    v_missing := v_missing || 'shadowfax_reconcile_token';
  end if;
  if not exists (select 1 from vault.secrets where name = 'daily_report_token') then
    v_missing := v_missing || 'daily_report_token';
  end if;

  if array_length(v_missing, 1) > 0 then
    raise exception using
      message = 'Vault is missing the secret(s): ' || array_to_string(v_missing, ', '),
      hint    = 'Create them with vault.create_secret() as described above, then run this file again. Scheduling a job whose secret does not exist is exactly the silent 401 this migration removes.';
  end if;
end
$do$;

-- ── shadowfax-reconcile (supersedes 0112) ───────────────────────────────────
-- Every 30 minutes. Shadowfax do not retry callbacks — "a failed callback
-- delivery is not retried" — so one dropped POST loses that event forever. If
-- the lost event was `delivered`, the order never becomes settleable and the
-- seller is simply never paid. The sweep is the system of record here; the
-- callback is what makes it feel live.

select cron.unschedule('shadowfax-reconcile')
where exists (select 1 from cron.job where jobname = 'shadowfax-reconcile');

-- timeout_milliseconds is NOT decoration. pg_net defaults to FIVE SECONDS, and
-- a sweep that bulk-tracks several batches and replays their timelines takes
-- longer. 0094's job was cut off at that default on its very first run.
select cron.schedule('shadowfax-reconcile', '*/30 * * * *', $job$
  select net.http_post(
    url                  := 'https://mtxmuaskmyhnqczctwlp.supabase.co/functions/v1/shadowfax-reconcile',
    headers              := jsonb_build_object(
                              'x-cron-key',   public.require_cron_secret('shadowfax_reconcile_token'),
                              'Content-Type', 'application/json'),
    body                 := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$job$);

-- ── daily-report (supersedes 0094) ──────────────────────────────────────────
-- 01:30 UTC = 07:00 IST. The Windows Scheduled Task "Agilam Daily Report" is
-- the fallback at 07:45 local and asks the database whether the report already
-- went out, so both running is harmless. This job has been posting a literal
-- placeholder since it was first scheduled; the fallback has been sending every
-- report since.

select cron.unschedule('daily-report')
where exists (select 1 from cron.job where jobname = 'daily-report');

select cron.schedule('daily-report', '30 1 * * *', $job$
  select net.http_post(
    url                  := 'https://mtxmuaskmyhnqczctwlp.supabase.co/functions/v1/daily-report',
    headers              := jsonb_build_object(
                              'Authorization', 'Bearer ' || public.require_cron_secret('daily_report_token'),
                              'Content-Type',  'application/json'),
    body                 := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
$job$);

-- ── Prove it ────────────────────────────────────────────────────────────────
-- The placeholder guards in 0094 and 0112 checked that a human had done a
-- substitution. There is no substitution left to check: what can still be wrong
-- is that a job did not register, or that it registered against a secret name
-- nothing will ever resolve. Both are checked here, and because cron.schedule()
-- is an ordinary transactional insert, a raise rolls the registration back.

do $do$
declare
  r         record;
  v_secret  text;
begin
  for r in
    select jobname, command from cron.job
    where jobname in ('shadowfax-reconcile', 'daily-report')
  loop
    -- Belt and braces: no job may carry a literal placeholder ever again.
    -- Built by concatenation so a find-and-replace across this file cannot
    -- substitute the check itself and make it pass while testing nothing.
    if position('<' || 'RECONCILE_TOKEN' || '>' in r.command) > 0
       or position('<' || 'REPORT_TOKEN' || '>' in r.command) > 0 then
      raise exception 'Job % still carries a token placeholder.', r.jobname;
    end if;
  end loop;

  if (select count(*) from cron.job where jobname in ('shadowfax-reconcile', 'daily-report')) <> 2 then
    raise exception 'Expected both shadowfax-reconcile and daily-report to be registered — cron.schedule() above did not take.';
  end if;

  -- Resolve each secret the way the jobs will, so a wrong NAME is caught now
  -- rather than at 01:30 tomorrow.
  v_secret := public.require_cron_secret('shadowfax_reconcile_token');
  v_secret := public.require_cron_secret('daily_report_token');
end
$do$;
