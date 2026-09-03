-- 0108 — the email broadcast history follows the send
--
-- 0089 kept both the send and its history at admin. The `broadcast-email` Edge
-- Function's gate moved to is_staff() when the notification-bell and email
-- composers were merged into one screen, so staff can now send an email
-- broadcast — and would then watch it vanish, because `email_broadcasts_read`
-- still tested is_admin() and the console's "Recently sent" panel would come
-- back empty for them. A sender who cannot see whether their own send worked is
-- worse off than one who was never allowed to send.
--
-- This widens WHO CAN READ the record, and nothing else. What a send is allowed
-- to do is untouched: the marketing/service consent split, the unsubscribe
-- headers and the per-recipient opt-out all live in the Edge Function and bind
-- every caller equally.
--
-- ⚠ `to authenticated` is not decoration, and it matters MORE here than it did
-- in 0089. A policy with no TO clause is TO PUBLIC, which attaches it to `anon`
-- as well; Postgres checks EXECUTE on any function a policy calls before it
-- tests a single row, and is_staff() is REVOKED from anon (unlike is_admin(),
-- which never was). An anonymous read would then fail 42501 rather than simply
-- returning no rows. That is exactly what blanked the storefront in 0086 — see
-- 0087, and the rule in CLAUDE.md.
--
-- Idempotent: drop-then-create, safe to re-run.

drop policy if exists email_broadcasts_read on email_broadcasts;
create policy email_broadcasts_read on email_broadcasts
  for select to authenticated
  using (is_staff());

comment on policy email_broadcasts_read on email_broadcasts is
  'Admins and staff read the broadcast history. is_staff() covers role admin and staff, and requires a live account plus a verified session. Widened from is_admin() in 0108.';

-- Writes stay closed, unchanged from 0089. Only the Edge Function writes here,
-- and it holds the service-role key, which bypasses RLS — a console session
-- must never be able to forge or edit a send record. Restated rather than left
-- implicit so nobody reading this file assumes the widening touched inserts.

-- Verify (as a staff session, not the SQL editor's service role):
--   select count(*) from email_broadcasts;  -- expect: the real count, not 0
