create table if not exists public.community_post_likes (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.community_post_likes enable row level security;
drop policy if exists "Users can read post likes" on public.community_post_likes;
create policy "Users can read post likes" on public.community_post_likes for select to authenticated using (true);
drop policy if exists "Users manage own post likes" on public.community_post_likes;
create policy "Users manage own post likes" on public.community_post_likes for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create table if not exists public.community_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 1000),
  created_at timestamptz not null default now()
);
alter table public.community_post_comments enable row level security;
drop policy if exists "Users read post comments" on public.community_post_comments;
create policy "Users read post comments" on public.community_post_comments for select to authenticated using (true);
drop policy if exists "Users add own post comments" on public.community_post_comments;
create policy "Users add own post comments" on public.community_post_comments for insert to authenticated with check ((select auth.uid()) = user_id);

create table if not exists public.community_post_shares (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.community_post_shares enable row level security;
drop policy if exists "Users send post shares" on public.community_post_shares;
create policy "Users send post shares" on public.community_post_shares for insert to authenticated with check ((select auth.uid()) = sender_id);
drop policy if exists "Users read received post shares" on public.community_post_shares;
create policy "Users read received post shares" on public.community_post_shares for select to authenticated using ((select auth.uid()) = recipient_id or (select auth.uid()) = sender_id);
