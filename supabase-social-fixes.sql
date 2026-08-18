-- 在 Supabase SQL Editor 完整執行一次。
-- 好友搜尋與邀請
drop policy if exists "Authenticated users read profiles" on public.profiles;
create policy "Authenticated users read profiles" on public.profiles for select to authenticated using (true);
drop policy if exists "Users send friend requests" on public.friend_requests;
create policy "Users send friend requests" on public.friend_requests for insert to authenticated with check ((select auth.uid()) = requester_id);
drop policy if exists "Users read own friend requests" on public.friend_requests;
create policy "Users read own friend requests" on public.friend_requests for select to authenticated using ((select auth.uid()) = requester_id or (select auth.uid()) = recipient_id);

-- 留言回覆與按讚
alter table public.community_post_comments add column if not exists reply_to_id uuid references public.community_post_comments(id) on delete set null;
create table if not exists public.community_comment_likes (
  comment_id uuid not null references public.community_post_comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(), primary key (comment_id, user_id)
);
alter table public.community_comment_likes enable row level security;
drop policy if exists "Users read comment likes" on public.community_comment_likes;
create policy "Users read comment likes" on public.community_comment_likes for select to authenticated using (true);
drop policy if exists "Users manage own comment likes" on public.community_comment_likes;
create policy "Users manage own comment likes" on public.community_comment_likes for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- 私有 Storage bucket 內的社區圖片可供已登入使用者讀取。
drop policy if exists "Authenticated users read community images" on storage.objects;
create policy "Authenticated users read community images" on storage.objects for select to authenticated using (bucket_id = 'community-images');
