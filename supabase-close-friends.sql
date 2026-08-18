-- 在 Supabase Dashboard -> SQL Editor 執行一次。
alter table public.friendships
  add column if not exists close_friend_user_ids uuid[] not null default '{}';

drop policy if exists "Users update own friendship labels" on public.friendships;
create policy "Users update own friendship labels"
on public.friendships
for update
to authenticated
using ((select auth.uid()) = user_a or (select auth.uid()) = user_b)
with check ((select auth.uid()) = user_a or (select auth.uid()) = user_b);
