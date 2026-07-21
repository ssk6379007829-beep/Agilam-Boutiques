-- Seller order notifications.
--
-- src/pages/seller/Notifications.tsx and src/data/notifications.ts have always
-- queried a `notifications` table that no schema ever created, so the seller's
-- inbox silently returned nothing and a new order reached the seller only if
-- they happened to refresh /seller/orders. api/place-order.js now writes a row
-- here (service role) for every boutique in a placed order, which is what makes
-- "the seller gets the order" an actual push rather than a poll.
--
-- Additive and idempotent. Run once in the Supabase SQL editor after 0001–0017.

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  -- Recipient. Sellers are notified on their boutique's owner profile.
  profile_id uuid not null references profiles(id) on delete cascade,
  -- Matches the tab labels in the seller Notifications screen.
  type text not null default 'Updates',
  title text not null,
  body text not null default '',
  -- Set for order notifications so the row can deep-link to the order.
  order_id uuid references orders(id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

do $$ begin
  alter table notifications add constraint notifications_type_check
    check (type in ('Orders', 'Messages', 'Updates'));
exception when duplicate_object then null; end $$;

-- The inbox is always read newest-first for one profile.
create index if not exists notifications_profile_idx
  on notifications (profile_id, created_at desc);
-- Powers the unread badge without scanning the whole inbox.
create index if not exists notifications_unread_idx
  on notifications (profile_id) where not read;

alter table notifications enable row level security;

-- A profile reads only its own notifications; admins can review any.
drop policy if exists "notifications: owner read" on notifications;
create policy "notifications: owner read" on notifications for select
  using (profile_id = auth.uid() or is_admin());

-- Marking as read is the only update a recipient may make. The `with check`
-- repeats the ownership test so a row can't be re-addressed to someone else.
drop policy if exists "notifications: owner update" on notifications;
create policy "notifications: owner update" on notifications for update
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- Deliberately no insert policy: notifications are system-generated. The order
-- pipeline writes them with the service role, which bypasses RLS, so no client
-- (buyer, seller or otherwise) can forge a notification for another account.
