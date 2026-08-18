-- 在 Supabase Dashboard -> SQL Editor 執行一次。
-- 新增私人帳號與貼文可見範圍的資料欄位。

alter table public.profiles
  add column if not exists is_private boolean not null default false;

alter table public.community_posts
  add column if not exists visibility text not null default 'public'
  check (visibility in ('public', 'friends', 'private'));

-- 使用者只可修改自己的隱私設定。
drop policy if exists "Users update own profile privacy" on public.profiles;
create policy "Users update own profile privacy"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);
