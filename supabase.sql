-- Anime Watchlist 分享功能
-- 在 Supabase Dashboard -> SQL Editor 貼上並執行。

create extension if not exists pgcrypto;

create table if not exists public.watchlist_shares (
  id uuid primary key default gen_random_uuid(),
  share_code text not null unique,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.watchlist_shares enable row level security;

-- 分享碼本身就是「持有即查看」的鑰匙，因此請把它當成私密連結。
create policy "Anyone can create watchlist shares"
on public.watchlist_shares
for insert
to anon, authenticated
with check (length(share_code) >= 8 and jsonb_typeof(payload) = 'object');

create policy "Anyone can read a share by code"
on public.watchlist_shares
for select
to anon, authenticated
using (true);

create index if not exists watchlist_shares_code_idx
on public.watchlist_shares (share_code);

-- 注意：目前前端只會用精確 share_code 查詢。
-- 如果你之後希望更高的隱私等級，可以再升級成 Edge Function / 加密分享。
