-- ----------------------------------------------------------------
-- Trove – Fix infinite recursion in board_collaborators RLS
-- Run in: Dashboard → SQL Editor → New query → Run
-- ----------------------------------------------------------------

-- board_collaborators policies queried `boards` directly, and boards'
-- policies query `board_collaborators` — that mutual reference makes
-- Postgres recurse forever when evaluating either table's row security.
-- Fix: route the "am I this board's owner" check through a SECURITY
-- DEFINER function, which bypasses RLS internally and breaks the loop.
create or replace function public.is_board_owner(check_board_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.boards where id = check_board_id and user_id = auth.uid()
  );
$$;

drop policy "collaborators_read" on public.board_collaborators;
create policy "collaborators_read" on public.board_collaborators for select using (
  auth.uid() = user_id or public.is_board_owner(board_id)
);

drop policy "collaborators_insert" on public.board_collaborators;
create policy "collaborators_insert" on public.board_collaborators for insert with check (
  public.is_board_owner(board_id)
);

drop policy "collaborators_delete" on public.board_collaborators;
create policy "collaborators_delete" on public.board_collaborators for delete using (
  auth.uid() = user_id or public.is_board_owner(board_id)
);
