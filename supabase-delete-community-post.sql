-- 在 Supabase Dashboard -> SQL Editor 執行一次。
-- 只允許登入使用者刪除自己的社區貼文、圖片資料與 Storage 圖片。

alter table public.community_posts enable row level security;
alter table public.community_images enable row level security;

drop policy if exists "Users can delete their own community posts" on public.community_posts;
create policy "Users can delete their own community posts"
on public.community_posts
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own community images" on public.community_images;
create policy "Users can delete their own community images"
on public.community_images
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own community image files" on storage.objects;
create policy "Users can delete their own community image files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'community-images'
  and owner_id = (select auth.uid())
);
