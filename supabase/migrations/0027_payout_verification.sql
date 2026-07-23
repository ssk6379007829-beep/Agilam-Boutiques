-- Penny-drop verification for seller payout details.
--
-- Before the automatic payout job (api/run-payouts.js) ever transfers to a
-- seller's BANK account, RazorpayX does a "fund account validation" — a ₹1
-- penny-drop that confirms the account number + IFSC are real and reachable and
-- returns the name the bank has on file. Only once that comes back active does
-- the boutique become eligible for auto-payout. This is the guard against a
-- typo'd account number quietly sending money to a valid-but-wrong account.
--
-- UPI/VPA fund accounts are not penny-dropped (RazorpayX validates the VPA at
-- payout time and a bad one simply fails the transfer, which the run releases
-- for retry); they are marked verified on creation with a note saying so.
--
-- Idempotent. Requires 0026.

alter table boutiques add column if not exists razorpayx_validation_id text;
alter table boutiques add column if not exists payout_verification_note text;
alter table boutiques add column if not exists payout_verification_status text not null default 'unverified';
do $$ begin
  alter table boutiques add constraint boutiques_payout_verif_check
    check (payout_verification_status in ('unverified', 'pending', 'verified', 'failed'));
exception when duplicate_object then null; end $$;

-- Keep the boolean gate on 0026 in step with the richer status.
update boutiques set payout_verification_status = 'verified'
 where payout_details_verified = true and payout_verification_status = 'unverified';

create index if not exists idx_boutiques_validation
  on boutiques (razorpayx_validation_id) where razorpayx_validation_id is not null;

-- ── Surface the verification state to owner/admin ───────────────────────────
-- Extends the private read so the admin console can show "Payout details:
-- Verified / Pending / Failed" next to the bank details. Changing the OUT
-- columns needs a drop first — CREATE OR REPLACE can't alter a return type.
drop function if exists boutique_private(uuid);
create function boutique_private(bid uuid)
returns table (
  gst_number text,
  business_reg_number text,
  bank_account_name text,
  bank_account_number text,
  bank_ifsc text,
  upi_id text,
  review_note text,
  payout_verification_status text,
  payout_verification_note text
)
language sql
security definer
stable
set search_path = public
as $$
  select b.gst_number, b.business_reg_number, b.bank_account_name,
         b.bank_account_number, b.bank_ifsc, b.upi_id, b.review_note,
         b.payout_verification_status, b.payout_verification_note
    from boutiques b
   where b.id = bid
     and (b.owner_id = auth.uid() or is_admin());
$$;

revoke all on function boutique_private(uuid) from public, anon;
grant execute on function boutique_private(uuid) to authenticated;
