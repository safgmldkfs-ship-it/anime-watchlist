-- 在 Supabase SQL Editor 執行一次。
alter table public.profiles add column if not exists friend_code text;
create unique index if not exists profiles_friend_code_unique on public.profiles(friend_code) where friend_code is not null;

-- 為既有帳號先建立唯一六位數代碼；前端會以 #123456 顯示。
update public.profiles
set friend_code = lpad((floor(random() * 1000000))::text, 6, '0')
where friend_code is null;
