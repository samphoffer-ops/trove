-- ----------------------------------------------------------------
-- Trove – Supabase schema
-- Run in: Dashboard → SQL Editor → New query → Run
-- ----------------------------------------------------------------

create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     text unique not null,
  display_name text,
  avatar_url   text,
  created_at   timestamptz default now()
);

create table public.boards (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  name             text not null,
  cover_product_id text,
  is_public        boolean not null default true,
  created_at       timestamptz default now()
);

create table public.board_items (
  id           uuid primary key default gen_random_uuid(),
  board_id     uuid not null references public.boards(id) on delete cascade,
  product_id   text not null,
  product_data jsonb not null,
  created_at   timestamptz default now(),
  unique(board_id, product_id)
);

create table public.follows (
  id           uuid primary key default gen_random_uuid(),
  follower_id  uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz default now(),
  unique(follower_id, following_id),
  check(follower_id <> following_id)
);

create index on public.boards(user_id);
create index on public.board_items(board_id);
create index on public.follows(follower_id);
create index on public.follows(following_id);

-- Row Level Security
alter table public.profiles   enable row level security;
alter table public.boards      enable row level security;
alter table public.board_items enable row level security;
alter table public.follows     enable row level security;

create policy "profiles_read"   on public.profiles for select using (true);
create policy "profiles_insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update" on public.profiles for update using (auth.uid() = id);

create policy "boards_read"   on public.boards for select using (is_public = true or auth.uid() = user_id);
create policy "boards_insert" on public.boards for insert with check (auth.uid() = user_id);
create policy "boards_update" on public.boards for update using (auth.uid() = user_id);
create policy "boards_delete" on public.boards for delete using (auth.uid() = user_id);

create policy "board_items_read" on public.board_items for select using (
  exists (select 1 from public.boards b where b.id = board_id and (b.is_public or b.user_id = auth.uid()))
);
create policy "board_items_insert" on public.board_items for insert with check (
  exists (select 1 from public.boards b where b.id = board_id and b.user_id = auth.uid())
);
create policy "board_items_delete" on public.board_items for delete using (
  exists (select 1 from public.boards b where b.id = board_id and b.user_id = auth.uid())
);

create policy "follows_read"   on public.follows for select using (true);
create policy "follows_insert" on public.follows for insert with check (auth.uid() = follower_id);
create policy "follows_delete" on public.follows for delete using (auth.uid() = follower_id);

-- Auto-create profile row when a user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
