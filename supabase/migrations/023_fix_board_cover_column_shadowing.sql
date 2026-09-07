-- ----------------------------------------------------------------
-- Trove – fix board cover uploads: real cause found (column shadowing)
-- Run in: Dashboard → SQL Editor → New query → Run
-- ----------------------------------------------------------------

-- The actual bug, present since migration 008 and carried forward
-- unnoticed into 009/012/021: `(storage.foldername(name))[1]` sits inside
-- `... from public.boards b where ...` — and boards has its own `name`
-- column (the board's title). Postgres resolves the bare `name` to the
-- CLOSER scope, so it silently became `storage.foldername(b.name)` — the
-- board's title text, not the uploaded object's path. A board name like
-- "Weekend Uniform" has no '/' in it, so foldername() never produced
-- anything matching a board id, and the ownership check was false for
-- every user, every time, no matter what the RLS re-applies (021 included)
-- changed — because none of them touched this line.
--
-- Confirmed by reading the live policy back with:
--   select policyname, with_check from pg_policies
--   where schemaname='storage' and tablename='objects'
--   and policyname like 'board_cover%';
--
-- Fix: qualify as `objects.name` so it can't be captured by the subquery.
drop policy if exists "board_cover_insert" on storage.objects;
create policy "board_cover_insert" on storage.objects for insert
  with check (
    bucket_id = 'board-covers'
    and exists (
      select 1 from public.boards b
      where b.id::text = (storage.foldername(objects.name))[1]
        and (b.user_id = auth.uid()
             or exists (select 1 from public.board_collaborators c where c.board_id = b.id and c.user_id = auth.uid() and c.role = 'editor'))
    )
  );

drop policy if exists "board_cover_update" on storage.objects;
create policy "board_cover_update" on storage.objects for update
  using (
    bucket_id = 'board-covers'
    and exists (
      select 1 from public.boards b
      where b.id::text = (storage.foldername(objects.name))[1]
        and (b.user_id = auth.uid()
             or exists (select 1 from public.board_collaborators c where c.board_id = b.id and c.user_id = auth.uid() and c.role = 'editor'))
    )
  );

drop policy if exists "board_cover_delete" on storage.objects;
create policy "board_cover_delete" on storage.objects for delete
  using (
    bucket_id = 'board-covers'
    and exists (
      select 1 from public.boards b
      where b.id::text = (storage.foldername(objects.name))[1]
        and (b.user_id = auth.uid()
             or exists (select 1 from public.board_collaborators c where c.board_id = b.id and c.user_id = auth.uid() and c.role = 'editor'))
    )
  );
