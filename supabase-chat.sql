-- 在 Supabase Dashboard -> SQL Editor 執行一次。
create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 4000),
  reply_to_id uuid references public.direct_messages(id) on delete set null,
  edited_at timestamptz,
  recalled_at timestamptz,
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);
create index if not exists direct_messages_participants_created_idx on public.direct_messages(sender_id, recipient_id, created_at);
alter table public.direct_messages enable row level security;
drop policy if exists "Participants read direct messages" on public.direct_messages;
create policy "Participants read direct messages" on public.direct_messages for select to authenticated using ((select auth.uid()) = sender_id or (select auth.uid()) = recipient_id);
drop policy if exists "Users send direct messages" on public.direct_messages;
create policy "Users send direct messages" on public.direct_messages for insert to authenticated with check ((select auth.uid()) = sender_id);
drop policy if exists "Senders edit direct messages" on public.direct_messages;
create policy "Senders edit direct messages" on public.direct_messages for update to authenticated using ((select auth.uid()) = sender_id) with check ((select auth.uid()) = sender_id);
