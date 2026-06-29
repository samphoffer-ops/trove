-- ----------------------------------------------------------------
-- Trove – idempotent re-apply of the storage SELECT policies from
-- migration 009 (board cover uploads have never once succeeded in
-- production data despite avatar uploads working, suggesting either a
-- partial application of 009 or something board-covers-specific)
-- Run in: Dashboard → SQL Editor → New query → Run
-- ----------------------------------------------------------------

drop policy if exists "avatar_select_public" on storage.objects;
create policy "avatar_select_public" on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "board_cover_select_public" on storage.objects;
create policy "board_cover_select_public" on storage.objects for select
  using (bucket_id = 'board-covers');
