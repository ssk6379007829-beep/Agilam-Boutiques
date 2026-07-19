-- Let sellers see the real buyer name in their Messages inbox.
--
-- The seller Messages page joins conversations → profiles to show each buyer's
-- full_name (src/data/chat.ts: fetchConversationsForBoutique). But the only
-- SELECT policy on `profiles` was "self or admin", so a seller reading another
-- user's profile row got filtered out by RLS and the join returned null —
-- every thread fell back to the literal "Customer".
--
-- This adds a scoped SELECT policy: a seller may read a profile row only when
-- that profile is the buyer in a conversation belonging to one of the seller's
-- boutiques. No broad exposure — just the buyers a seller is actually chatting
-- with. Additive and idempotent; safe to run after 0001–0006.

do $$ begin
  create policy "profiles: seller reads chat buyers" on profiles for select
    using (
      exists (
        select 1
        from conversations c
        join boutiques b on b.id = c.boutique_id
        where c.buyer_id = profiles.id
          and b.owner_id = auth.uid()
      )
    );
exception when duplicate_object then null; end $$;
