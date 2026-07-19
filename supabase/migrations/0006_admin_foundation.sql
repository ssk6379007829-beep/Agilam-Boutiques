-- Admin foundation — backing columns/tables the enterprise admin console needs.
--
-- Fully additive and idempotent: safe to run once in the Supabase SQL editor
-- after 0001–0005. Nothing here drops data or changes existing defaults in a way
-- that breaks the buyer/seller apps.
--
--   • products.status      — moderation state (existing rows default 'active' so
--                            the live catalogue is unchanged).
--   • products.deleted_at  — soft delete (admin can hide/restore, never hard-lose).
--   • profiles.status      — 'active' | 'blocked' account state.
--   • profiles.deleted_at  — soft delete for accounts.
--   • profiles.updated_at  — audit timestamp.
--   • orders.refunded / refunded_at — refund flag distinct from the order status.
--   • admin_activity_log   — append-only audit trail of admin actions.
--   • indexes              — for the admin list/aggregate queries.

-- ── Products: moderation status + soft delete ───────────────────────────────
do $$ begin
  alter table products add column if not exists status text not null default 'active';
exception when others then null; end $$;

do $$ begin
  alter table products add constraint products_status_check
    check (status in ('pending','active','hidden','rejected'));
exception when duplicate_object then null; end $$;

alter table products add column if not exists deleted_at timestamptz;

-- ── Profiles: account status + soft delete + audit timestamp ─────────────────
do $$ begin
  alter table profiles add column if not exists status text not null default 'active';
exception when others then null; end $$;

do $$ begin
  alter table profiles add constraint profiles_status_check
    check (status in ('active','blocked'));
exception when duplicate_object then null; end $$;

alter table profiles add column if not exists deleted_at timestamptz;
alter table profiles add column if not exists updated_at timestamptz;

-- ── Orders: refund flag (status stays the fulfilment state) ──────────────────
alter table orders add column if not exists refunded boolean not null default false;
alter table orders add column if not exists refunded_at timestamptz;

-- ── Admin activity log (append-only audit trail) ────────────────────────────
create table if not exists admin_activity_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id) on delete set null,
  actor_name text not null default '',
  action text not null,                    -- e.g. 'product.hide', 'user.block'
  entity_type text not null default '',    -- e.g. 'product', 'order', 'profile'
  entity_id text,                          -- id/label of the affected row
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);

alter table admin_activity_log enable row level security;

do $$ begin
  create policy "activity: admin read" on admin_activity_log for select using (is_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "activity: admin insert" on admin_activity_log for insert with check (is_admin());
exception when duplicate_object then null; end $$;

-- ── Indexes for the admin list & aggregate queries ──────────────────────────
create index if not exists idx_orders_created_at on orders (created_at desc);
create index if not exists idx_orders_status on orders (status);
create index if not exists idx_orders_boutique on orders (boutique_id);
create index if not exists idx_orders_buyer on orders (buyer_id);
create index if not exists idx_products_boutique on products (boutique_id);
create index if not exists idx_products_status on products (status);
create index if not exists idx_products_deleted on products (deleted_at);
create index if not exists idx_profiles_role on profiles (role);
create index if not exists idx_profiles_status on profiles (status);
create index if not exists idx_activity_created_at on admin_activity_log (created_at desc);

-- ── Realtime for the live dashboard counters ────────────────────────────────
do $$ begin
  alter publication supabase_realtime add table orders;
exception when duplicate_object then null; end $$;
