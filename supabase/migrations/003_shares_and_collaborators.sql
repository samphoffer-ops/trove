-- ----------------------------------------------------------------
-- Trove – DM product shares + invite-only board collaborators
-- Run in: Dashboard → SQL Editor → New query → Run
-- ----------------------------------------------------------------

-- Lightweight share receipts: "send this product to a friend".
-- Not a full chat thread — sender + recipient + a snapshot of the product.
create table public.shares (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  product_id   text not null,
  product_data jsonb not null,
  read_at      timestamptz,
  created_at   timestamptz default now(),
  check (sender_id <> recipient_id)
);

create index on public.shares(recipient_id);
create index on public.shares(sender_id);

alter table public.shares enable row level security;

create policy "shares_read" on public.shares for select using (
  auth.uid() = sender_id or auth.uid() = recipient_id
);
create policy "shares_insert" on public.shares for insert with check (
  auth.uid() = sender_id
);
create policy "shares_update" on public.shares for update using (
  auth.uid() = recipient_id
);

-- Invite-only board collaborators. 'editor' can view + add + remove items;
-- 'viewer' is reserved for future use (not exposed in the invite UI yet).
create table public.board_collaborators (
  id         uuid primary key default gen_random_uuid(),
  board_id   uuid not null references public.boards(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  invited_by uuid not null references public.profiles(id) on delete cascade,
  role       text not null default 'editor' check (role in ('editor', 'viewer')),
  created_at timestamptz default now(),
  unique(board_id, user_id)
);

create index on public.board_collaborators(board_id);
create index on public.board_collaborators(user_id);

alter table public.board_collaborators enable row level security;

create policy "collaborators_read" on public.board_collaborators for select using (
  auth.uid() = user_id
  or exists (select 1 from public.boards b where b.id = board_id and b.user_id = auth.uid())
);
create policy "collaborators_insert" on public.board_collaborators for insert with check (
  exists (select 1 from public.boards b where b.id = board_id and b.user_id = auth.uid())
);
create policy "collaborators_delete" on public.board_collaborators for delete using (
  auth.uid() = user_id
  or exists (select 1 from public.boards b where b.id = board_id and b.user_id = auth.uid())
);

-- Extend board access to collaborators (previously: owner or public only).
drop policy "boards_read" on public.boards;
create policy "boards_read" on public.boards for select using (
  is_public = true
  or auth.uid() = user_id
  or exists (select 1 from public.board_collaborators c where c.board_id = id and c.user_id = auth.uid())
);

-- Editor collaborators can update board metadata (e.g. cover image) too, not just items.
drop policy "boards_update" on public.boards;
create policy "boards_update" on public.boards for update using (
  auth.uid() = user_id
  or exists (select 1 from public.board_collaborators c where c.board_id = id and c.user_id = auth.uid() and c.role = 'editor')
);

drop policy "board_items_read" on public.board_items;
create policy "board_items_read" on public.board_items for select using (
  exists (
    select 1 from public.boards b
    where b.id = board_id
      and (b.is_public or b.user_id = auth.uid()
           or exists (select 1 from public.board_collaborators c where c.board_id = b.id and c.user_id = auth.uid()))
  )
);

drop policy "board_items_insert" on public.board_items;
create policy "board_items_insert" on public.board_items for insert with check (
  exists (
    select 1 from public.boards b
    where b.id = board_id
      and (b.user_id = auth.uid()
           or exists (select 1 from public.board_collaborators c where c.board_id = b.id and c.user_id = auth.uid() and c.role = 'editor'))
  )
);

drop policy "board_items_delete" on public.board_items;
create policy "board_items_delete" on public.board_items for delete using (
  exists (
    select 1 from public.boards b
    where b.id = board_id
      and (b.user_id = auth.uid()
           or exists (select 1 from public.board_collaborators c where c.board_id = b.id and c.user_id = auth.uid() and c.role = 'editor'))
  )
);
