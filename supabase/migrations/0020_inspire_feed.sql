-- Inspire — the boutique feed.
--
-- A scrolling, Instagram-style feed of posts from the boutiques a buyer follows.
-- A post is a boutique's own editorial content (a lookbook, a new drop, an
-- offer): a title, a caption, up to a handful of photos, and a call to action
-- that lands on a product or a filtered collection.
--
-- Three tables:
--   posts       — the content, owned by a boutique, publicly readable when
--                 published and the boutique is approved (same shape as products).
--   post_likes  — one row per (post, signed-in buyer). Powers "posts I liked"
--                 across devices. The shared counter on posts.likes_count is
--                 maintained by the RPC below, never by a trigger, so there is
--                 exactly one writer for it.
--   post_saves  — private bookmarks, owner-only, mirroring the wishlist table.
--
-- Buyers browse anonymously, so liking cannot require an account (see 0004 for
-- the same reasoning behind boutique follows). `toggle_post_like` is therefore
-- SECURITY DEFINER: it moves the shared count for anyone, and additionally
-- records a per-account row when the caller happens to be signed in.
--
-- Idempotent: re-runnable in the Supabase SQL editor. Run after 0019.

-- ── Posts ────────────────────────────────────────────────────────────────────
create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  boutique_id uuid not null references boutiques(id) on delete cascade,
  -- "✨ Wedding Collection 2026"
  title text not null default '',
  -- "Pure kanchipuram silk sarees in new shades"
  caption text not null default '',
  -- Public URLs in the `post-images` bucket, in display order.
  images text[] not null default '{}',
  -- Where the call to action goes. A product wins; otherwise the category opens
  -- the filtered collections grid; with neither, it opens the boutique.
  product_id uuid references products(id) on delete set null,
  category text,
  cta_label text not null default 'Shop Collection',
  status text not null default 'published' check (status in ('published', 'hidden')),
  likes_count int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists posts_boutique_created_idx on posts (boutique_id, created_at desc);
create index if not exists posts_published_created_idx on posts (created_at desc) where status = 'published';

alter table posts enable row level security;

drop policy if exists "posts: public read published"   on posts;
drop policy if exists "posts: owner insert"            on posts;
drop policy if exists "posts: owner or admin update"   on posts;
drop policy if exists "posts: owner or admin delete"   on posts;

-- Published posts from approved boutiques are public, so anonymous buyers get a
-- feed. A boutique always sees its own, including hidden drafts.
create policy "posts: public read published" on posts for select
  using (
    (status = 'published' and exists (select 1 from boutiques b where b.id = boutique_id and b.status = 'approved'))
    or exists (select 1 from boutiques b where b.id = boutique_id and b.owner_id = auth.uid())
    or is_admin()
  );

create policy "posts: owner insert" on posts for insert
  with check (exists (select 1 from boutiques b where b.id = boutique_id and b.owner_id = auth.uid()));

create policy "posts: owner or admin update" on posts for update
  using (exists (select 1 from boutiques b where b.id = boutique_id and b.owner_id = auth.uid()) or is_admin());

create policy "posts: owner or admin delete" on posts for delete
  using (exists (select 1 from boutiques b where b.id = boutique_id and b.owner_id = auth.uid()) or is_admin());

-- ── Likes ────────────────────────────────────────────────────────────────────
create table if not exists post_likes (
  post_id uuid not null references posts(id) on delete cascade,
  buyer_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, buyer_id)
);

alter table post_likes enable row level security;

drop policy if exists "post_likes: owner manage" on post_likes;
create policy "post_likes: owner manage" on post_likes for all
  using (buyer_id = auth.uid()) with check (buyer_id = auth.uid());

-- ── Saves (private bookmarks) ────────────────────────────────────────────────
create table if not exists post_saves (
  post_id uuid not null references posts(id) on delete cascade,
  buyer_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, buyer_id)
);

alter table post_saves enable row level security;

drop policy if exists "post_saves: owner manage" on post_saves;
create policy "post_saves: owner manage" on post_saves for all
  using (buyer_id = auth.uid()) with check (buyer_id = auth.uid());

-- ── Like toggle ──────────────────────────────────────────────────────────────
-- Returns the new shared count. SECURITY DEFINER so it can write likes_count
-- past the owner/admin-only update policy, while only ever touching that column.
--
-- For a signed-in buyer the per-account row is the source of truth and the
-- counter only moves when the row actually changed, so double-tapping (or a
-- retried request) can't inflate it. Guests have no row to key on, so their tap
-- moves the counter directly — the client keeps the per-device state and won't
-- send the same direction twice.
create or replace function toggle_post_like(pid uuid, do_like boolean)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  changed boolean := true;
  new_count int;
begin
  if uid is not null then
    if do_like then
      insert into post_likes (post_id, buyer_id) values (pid, uid) on conflict do nothing;
    else
      delete from post_likes where post_id = pid and buyer_id = uid;
    end if;
    -- FOUND is false when ON CONFLICT DO NOTHING swallowed the insert, or when
    -- the delete matched nothing — i.e. the like state was already what was asked.
    changed := found;
  end if;

  if changed then
    update posts
      set likes_count = greatest(0, likes_count + case when do_like then 1 else -1 end)
      where id = pid
      returning likes_count into new_count;
  else
    select likes_count into new_count from posts where id = pid;
  end if;

  return coalesce(new_count, 0);
end;
$$;

grant execute on function toggle_post_like(uuid, boolean) to anon, authenticated;

-- ── Storage: post photos ─────────────────────────────────────────────────────
-- Same proven policy shape as 0017/0019 (authenticated + bucket check, no
-- path-ownership sub-check), which is what stopped uploads hitting RLS walls.
insert into storage.buckets (id, name, public)
values ('post-images', 'post-images', true)
on conflict (id) do update set public = true;

drop policy if exists "post-images: public read"   on storage.objects;
drop policy if exists "post-images: authed upload" on storage.objects;
drop policy if exists "post-images: authed update" on storage.objects;
drop policy if exists "post-images: authed delete" on storage.objects;

create policy "post-images: public read" on storage.objects for select
  using (bucket_id = 'post-images');

create policy "post-images: authed upload" on storage.objects for insert
  to authenticated
  with check (bucket_id = 'post-images');

create policy "post-images: authed update" on storage.objects for update
  to authenticated
  using (bucket_id = 'post-images')
  with check (bucket_id = 'post-images');

create policy "post-images: authed delete" on storage.objects for delete
  to authenticated
  using (bucket_id = 'post-images');

-- ── Realtime ─────────────────────────────────────────────────────────────────
-- So an open feed sees like counts move as others tap. Guarded — re-adding a
-- table to the publication errors otherwise.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'posts'
  ) then
    alter publication supabase_realtime add table posts;
  end if;
end $$;
