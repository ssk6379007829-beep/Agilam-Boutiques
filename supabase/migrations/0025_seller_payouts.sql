-- Seller payouts — the recorded settlement of what the platform owes a boutique
-- after every deduction.
--
-- Until now the admin console could show a per-order commission (Payments.tsx)
-- but there was nowhere to answer the only question that actually moves money:
-- "how much do we owe this seller right now, and once we pay it, how do we not
-- pay it again?". This migration adds that.
--
-- The money model, in one place:
--   • The platform take is a flat 10% of the goods value, and that 10% is meant
--     to already cover the payment-gateway fee and tax — it is the single figure
--     withheld from the seller, not a commission on top of other charges.
--   • Prepaid (gateway) orders: the platform is holding the buyer's money, so it
--     OWES the seller  goods − 10%.  The shipping/COD fees the buyer paid were
--     collected by the platform and stay with it (they never entered `total`).
--   • COD orders: the seller collected the cash at the door, so the seller OWES
--     the platform its 10% plus the shipping/COD fees it collected on the
--     platform's behalf. That is netted OFF the payout — one boutique settles to
--     a single figure that can legitimately go negative (seller owes us).
--   • Offline / walk-in POS sales (channel = 'offline') are the seller's own till
--     and never part of a platform settlement, so they are excluded entirely.
--
-- An order counts towards a payout only once it is real money that has actually
-- moved and has not been unwound: payment_status = 'paid', not refunded, and not
-- rejected/cancelled. `payout_id` stamps an order the moment it is settled, so
-- the outstanding balance is simply "settleable orders with payout_id is null" —
-- double-paying is structurally impossible.
--
-- Idempotent: re-runnable in the Supabase SQL editor. Requires 0006 + 0022.

-- ── Payout records ──────────────────────────────────────────────────────────
create table if not exists payouts (
  id uuid primary key default gen_random_uuid(),
  boutique_id uuid not null references boutiques(id) on delete cascade,
  -- Net paid to the seller. Negative means the seller owed the platform (their
  -- COD commission for the cycle outweighed their prepaid earnings).
  amount numeric(12,2) not null,
  orders_count int not null default 0,
  -- Breakdown, snapshotted so a later change to the rate never rewrites history.
  gross numeric(12,2) not null default 0,          -- prepaid goods value settled
  commission numeric(12,2) not null default 0,     -- 10% take across all orders
  fees numeric(12,2) not null default 0,           -- shipping + COD fees retained
  cod_adjustment numeric(12,2) not null default 0, -- commission+fees netted off for COD cash
  note text,
  created_by uuid references profiles(id) on delete set null,
  created_by_name text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_payouts_boutique on payouts (boutique_id, created_at desc);

-- Which payout settled an order. Null = still outstanding.
alter table orders add column if not exists payout_id uuid references payouts(id) on delete set null;
create index if not exists idx_orders_payout on orders (payout_id);

alter table payouts enable row level security;

do $$ begin
  create policy "payouts: admin all" on payouts for all using (is_admin()) with check (is_admin());
exception when duplicate_object then null; end $$;

-- A seller may read their own boutique's payout history (their statement), but
-- never create one — settlement is an admin action.
do $$ begin
  create policy "payouts: seller read own" on payouts for select using (
    exists (select 1 from boutiques b where b.id = payouts.boutique_id and b.owner_id = auth.uid())
  );
exception when duplicate_object then null; end $$;

-- ── Settle a boutique's outstanding balance ─────────────────────────────────
-- Recomputes the amount server-side from the orders themselves (never trusts a
-- figure sent by the client), writes one payout row, and stamps every order it
-- covered — all in one transaction so a partial settlement can never happen.
create or replace function settle_boutique_payout(p_boutique_id uuid, p_note text default null)
returns payouts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rate constant numeric := 0.10;
  v_payout payouts;
  v_ids uuid[];
  v_count int := 0;
  v_prepaid_goods numeric := 0;
  v_prepaid_commission numeric := 0;
  v_prepaid_fees numeric := 0;
  v_cod_commission numeric := 0;
  v_cod_fees numeric := 0;
  v_amount numeric := 0;
begin
  if not is_admin() then
    raise exception 'payouts: admin only';
  end if;

  select
    coalesce(array_agg(o.id), '{}'::uuid[]),
    count(*)::int,
    coalesce(sum(o.total) filter (where o.payment_method is distinct from 'COD'), 0),
    coalesce(sum(round(o.total * v_rate, 2)) filter (where o.payment_method is distinct from 'COD'), 0),
    coalesce(sum(o.cod_fee + o.shipping_fee) filter (where o.payment_method is distinct from 'COD'), 0),
    coalesce(sum(round(o.total * v_rate, 2)) filter (where o.payment_method = 'COD'), 0),
    coalesce(sum(o.cod_fee + o.shipping_fee) filter (where o.payment_method = 'COD'), 0)
  into v_ids, v_count, v_prepaid_goods, v_prepaid_commission, v_prepaid_fees, v_cod_commission, v_cod_fees
  from orders o
  where o.boutique_id = p_boutique_id
    and o.payout_id is null
    and o.payment_status = 'paid'
    and o.refunded = false
    and o.status not in ('rejected', 'cancelled')
    and coalesce(o.channel, 'online') <> 'offline';

  if v_count = 0 then
    raise exception 'payouts: nothing to settle for this boutique';
  end if;

  -- Net payable = prepaid(goods − commission) − cod(commission + fees).
  v_amount := (v_prepaid_goods - v_prepaid_commission) - (v_cod_commission + v_cod_fees);

  insert into payouts (
    boutique_id, amount, orders_count, gross, commission, fees, cod_adjustment,
    note, created_by, created_by_name
  ) values (
    p_boutique_id,
    round(v_amount, 2),
    v_count,
    round(v_prepaid_goods, 2),
    round(v_prepaid_commission + v_cod_commission, 2),
    round(v_prepaid_fees + v_cod_fees, 2),
    round(v_cod_commission + v_cod_fees, 2),
    nullif(btrim(coalesce(p_note, '')), ''),
    auth.uid(),
    coalesce((select full_name from profiles where id = auth.uid()), 'Admin')
  )
  returning * into v_payout;

  update orders set payout_id = v_payout.id where id = any(v_ids);

  return v_payout;
end $$;

revoke all on function settle_boutique_payout(uuid, text) from public, anon;
grant execute on function settle_boutique_payout(uuid, text) to authenticated;
