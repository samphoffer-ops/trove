-- ----------------------------------------------------------------
-- Trove – shop_for preference, board cover photos, avatar/cover storage
-- Run in: Dashboard → SQL Editor → New query → Run
-- ----------------------------------------------------------------

-- "Shop for" — what categories of products a user wants surfaced (men's,
-- women's, unisex). Framed as a shopping preference, not gender identity.
-- Array so someone can pick more than one. Not consumed by any ranking yet
-- (same state as taste_brands/taste_styles/taste_categories) — captured now,
-- wired into the feed later.
alter table public.profiles add column if not exists shop_for text[] not null default '{}';

-- Board cover photo — independent upload, distinct from cover_product_id
-- (which points at one of the board's own saved items). This is a real
-- image someone picks to set the board's vibe, not tied to its contents.
alter table public.boards add column if not exists cover_image_url text;

-- Storage buckets. Both public-read (avatars/board covers are meant to be
-- visible to anyone who can see the profile/board) — the `public` flag
-- handles read access without needing a SELECT policy below; insert/update/
-- delete still need explicit RLS.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('board-covers', 'board-covers', true)
on conflict (id) do nothing;

-- avatars/{user_id}/avatar.<ext> — only that user can write their own.
create policy "avatar_insert_own" on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatar_update_own" on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatar_delete_own" on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- board-covers/{board_id}/cover.<ext> — board owner or an editor collaborator,
-- same permission boundary as boards_update already uses for board metadata.
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
