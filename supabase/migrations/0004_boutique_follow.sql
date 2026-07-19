-- Real-time boutique follows.
--
-- Buyers browse anonymously (no auth id), so a follow can't be keyed to a user
-- row. Instead the client keeps the per-device follow state locally and calls
-- this RPC to move the shared `followers_count` up or down. The function is
-- SECURITY DEFINER so it can update the count past the owner/admin-only RLS
-- update policy, while only ever touching that one column.
--
-- Boutiques is also added to the realtime publication so every open profile
-- sees the number change live as others follow.
--
-- Run this once in the Supabase SQL editor after the earlier migrations.

create or replace function toggle_boutique_follow(bid uuid, do_follow boolean)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count int;
begin
  update boutiques
    set followers_count = greatest(0, followers_count + case when do_follow then 1 else -1 end)
    where id = bid
    returning followers_count into new_count;
  return coalesce(new_count, 0);
end;
$$;

grant execute on function toggle_boutique_follow(uuid, boolean) to anon, authenticated;

-- Publish boutiques for realtime (guarded — re-adding a table errors otherwise).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'boutiques'
  ) then
    alter publication supabase_realtime add table boutiques;
  end if;
end $$;
