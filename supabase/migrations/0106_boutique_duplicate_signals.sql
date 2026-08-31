-- Duplicate-applicant signals for the seller verification queue.
--
-- An admin approving a boutique is looking at one application in isolation, and
-- the single thing that isolation hides is the one that matters most: whether
-- the same person is already on the platform. A fraudster who has been rejected
-- once simply signs up again with a new email and a new shop name — but almost
-- never with a new mobile number, and essentially never with a new BANK ACCOUNT,
-- because the account is the whole point of the exercise.
--
-- The admin console can already spot a repeated shop name, address, pincode or
-- map pin by itself: those columns are on the public grant, so every boutique
-- row is in the browser already and the comparison is free (see
-- `publicDuplicates` in src/lib/boutiqueReview.ts).
--
-- Phone, WhatsApp, email, bank account and UPI are NOT. Migrations 0021 and 0073
-- deliberately took them off the column grant — they were bulk-readable with the
-- anon key that ships in the browser bundle — and put them behind
-- `boutique_private(bid)`, which answers for ONE boutique at a time. That is the
-- right shape for showing an admin a seller's number, and the wrong shape for
-- asking "is this number anywhere else": doing it client-side would mean calling
-- the RPC once per boutique and pulling every seller's contact details into the
-- browser, which is precisely what 0073 stopped.
--
-- So the comparison happens here instead, in the database, and only the ANSWER
-- crosses the wire — the id, name and status of the other shop plus which fields
-- collided. The colliding values themselves are never returned. An admin who
-- wants to see the number opens that boutique and reads it from
-- `boutique_private` as before.
--
-- Idempotent: re-runnable in the Supabase SQL editor. Requires 0073.

-- ── Matching rules ──────────────────────────────────────────────────────────
-- Every field is normalised before comparison, because two people entering the
-- same detail rarely type it the same way:
--
--   phone / whatsapp  last 10 digits, punctuation and +91 stripped, so
--                     "+91 98765 43210", "098765 43210" and "9876543210" are
--                     one number. Anything shorter than 10 digits is treated as
--                     absent rather than matched — a half-typed number would
--                     otherwise collide with every other half-typed number.
--                     Compared ACROSS the two fields: a second application that
--                     puts the first one's mobile in the WhatsApp box is the
--                     same person, and checking phone-to-phone only would miss it.
--   email             lowercased and trimmed.
--   bank account      digits only. Leading zeros are significant in Indian
--                     account numbers and are kept.
--   upi               lowercased and trimmed.
--
-- Rejected and draft boutiques are matched too, and that is the point: "same
-- account number as a shop you rejected in March" is the most valuable sentence
-- this function can produce.

-- Dropped first for the same reason 0021 drops `boutique_private`: CREATE OR
-- REPLACE cannot change a function's return type (SQLSTATE 42P13), so a later
-- edit to the OUT columns would make this file fail on a database that already
-- has the previous shape. Dropping keeps it re-runnable in any order.
drop function if exists boutique_duplicate_signals(uuid);
create function boutique_duplicate_signals(bid uuid)
returns table (
  other_id uuid,
  other_name text,
  other_status text,
  other_city text,
  other_submitted_at timestamptz,
  matched_fields text[]
)
language sql
security definer
stable
set search_path = public
as $$
  with norm as (
    select
      b.id,
      b.name,
      b.status,
      b.city,
      b.submitted_at,
      -- Ten-digit forms, or NULL when there is not enough of a number to trust.
      case when length(regexp_replace(coalesce(b.phone, ''), '\D', '', 'g')) >= 10
           then right(regexp_replace(coalesce(b.phone, ''), '\D', '', 'g'), 10) end as ph,
      case when length(regexp_replace(coalesce(b.whatsapp, ''), '\D', '', 'g')) >= 10
           then right(regexp_replace(coalesce(b.whatsapp, ''), '\D', '', 'g'), 10) end as wa,
      nullif(lower(trim(coalesce(b.email, ''))), '') as em,
      nullif(regexp_replace(coalesce(b.bank_account_number, ''), '\D', '', 'g'), '') as acct,
      nullif(lower(trim(coalesce(b.upi_id, ''))), '') as upi
    from boutiques b
  ),
  me as (
    select * from norm where id = bid
  ),
  hits as (
    select
      o.id,
      o.name,
      o.status,
      o.city,
      o.submitted_at,
      -- Explicitly text[] and an explicitly typed NULL: every element here is a
      -- CASE that can be NULL on an honest application, and an all-NULL array
      -- literal has nothing for the planner to infer an element type from.
      array_remove(array[
        -- Either of their two numbers against either of ours.
        case when (o.ph is not null and (o.ph = m.ph or o.ph = m.wa))
               or (o.wa is not null and (o.wa = m.ph or o.wa = m.wa))
             then 'phone' end,
        case when o.em is not null and o.em = m.em then 'email' end,
        case when o.acct is not null and o.acct = m.acct then 'bank_account' end,
        case when o.upi is not null and o.upi = m.upi then 'upi' end
      ]::text[], null::text) as matched
    from norm o
    cross join me m
    where o.id <> m.id
  )
  select id, name, status, city, submitted_at, matched
    from hits
   where is_admin()
     and array_length(matched, 1) > 0
   order by array_length(matched, 1) desc, submitted_at desc nulls last;
$$;

-- Admin-only, and belt-and-braces about it: the `is_admin()` predicate inside
-- the query is the real gate (a non-admin gets zero rows), and the grant keeps
-- anon from calling it at all. Both matter — SECURITY DEFINER means the column
-- grants of 0021/0073 do not apply inside the function body.
revoke all on function boutique_duplicate_signals(uuid) from public, anon;
grant execute on function boutique_duplicate_signals(uuid) to authenticated;

-- ── Indexes ─────────────────────────────────────────────────────────────────
-- The function scans `boutiques` twice. At marketplace scale that is a few
-- thousand rows and a sequential scan is genuinely fine — but the normalised
-- expressions cannot use an index anyway (they are functional expressions over
-- the columns), so there is deliberately nothing to add here. If the table ever
-- grows past the point where this is instant, the fix is expression indexes on
-- the same four normalisations, not a different query.
