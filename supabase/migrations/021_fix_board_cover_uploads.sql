-- ----------------------------------------------------------------
-- Trove – fix board cover uploads (still failing in production)
-- Run in: Dashboard → SQL Editor → New query → Run
-- ----------------------------------------------------------------

-- Board cover uploads have reportedly never worked in production, even
-- after 008/009/012. Those migrations use plain `create policy` (no
-- drop-if-exists), so if any single statement in one of them failed or
-- was skipped when it was run, that policy would just be silently
-- missing with no way to tell from the client — the upload fails with a
-- generic RLS error either way. This is a full idempotent re-apply of
-- every storage.objects policy board covers depend on (bucket, select,
-- insert, update, delete), safe to run no matter what state the
-- database is actually in.

insert into storage.buckets (id, name, public)
values ('board-covers', 'board-covers', true)
on conflict (id) do nothing;

drop policy if exists "board_cover_select_public" on storage.objects;
create policy "board_cover_select_public" on storage.objects for select
  using (bucket_id = 'board-covers');

drop policy if exists "board_cover_insert" on storage.objects;
create policy "board_cover_insert" on storage.objects for insert
  with check (
    bucket_id = 'board-covers'
    and exists (
      select 1 from public.boards b
      where b.id::text = (storage.foldername(name))[1]
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
      where b.id::text = (storage.foldername(name))[1]
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
      where b.id::text = (storage.foldername(name))[1]
        and (b.user_id = auth.uid()
             or exists (select 1 from public.board_collaborators c where c.board_id = b.id and c.user_id = auth.uid() and c.role = 'editor'))
    )
  );
