-- SUPERSEDED BY 0113 — this file intentionally does nothing. Run 0113 instead.
--
-- 0112 scheduled the shadowfax-reconcile sweep with a literal <RECONCILE_TOKEN>
-- placeholder that had to be replaced by hand in the SQL editor before running.
-- It was never successfully applied: the guard at the bottom of the original
-- file caught the un-substituted placeholder and rolled the registration back,
-- which is exactly what it was written to do.
--
-- Rather than fix the substitution, 0113 removes the step. It registers the
-- same job reading the token from Vault at execution time, so no migration ever
-- carries a secret and a missing one fails loudly in cron.job_run_details
-- instead of posting an unauthenticated request forever. 0113 does the same for
-- the daily-report job from 0094, which HAS been running with its placeholder
-- since the day it was scheduled.
--
-- The file is kept as a no-op rather than deleted because the number is already
-- referenced in CLAUDE.md's history and in the commit that introduced it, and a
-- missing number in a hand-applied series is a question someone has to answer
-- twice. Running it is harmless.
--
-- Everything that was here now lives in 0113_cron_secrets_from_vault.sql.
--
-- (The buyer-coordinate columns this file once discussed were deliberately not
-- added then and are still not added: they serve only Shadowfax's hyperlocal
-- product, which is out of scope, and checkout collects no lat/long. They
-- belong in the same migration as the checkout change that fills them.)

do $do$
begin
  raise notice '0112 is superseded by 0113_cron_secrets_from_vault.sql — nothing to do.';
end
$do$;
