-- 在 Supabase Dashboard -> SQL Editor 執行一次。
-- 建立個人頭像 Storage bucket 與存取規則。

insert into storage.buckets (id, name, public)
values ('profile-avatars', 'profile-avatars', true)
on conflict (id) do update set public = true;

drop policy if exists "Public read profile avatars" on storage.objects;
create policy "Public read profile avatars"
on storage.objects for select
using (bucket_id = 'profile-avatars');

drop policy if exists "Users upload own profile avatars" on storage.objects;
create policy "Users upload own profile avatars"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users update own profile avatars" on storage.objects;
create policy "Users update own profile avatars"
on storage.objects for update to authenticated
using (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users delete own profile avatars" on storage.objects;
create policy "Users delete own profile avatars"
on storage.objects for delete to authenticated
using (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
