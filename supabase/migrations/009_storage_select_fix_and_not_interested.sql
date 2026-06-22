-- ----------------------------------------------------------------
-- Trove – fix storage upload RLS, add "not interested" signal, cleanup
-- Run in: Dashboard → SQL Editor → New query → Run
-- ----------------------------------------------------------------

-- Migration 008 only added INSERT/UPDATE/DELETE policies on storage.objects
-- for the avatars/board-covers buckets — missing a SELECT policy. Supabase
-- Storage's upload() does an implicit read-back of the row it just wrote to
-- return its metadata to the client, and that read is itself subject to RLS.
-- With no SELECT policy at all, that read-back has nothing permitting it,
-- and the whole upload fails with "new row violates row-level security
-- policy" even though the actual INSERT condition was correct. Both buckets
-- are public anyway, so this is intentionally permissive.
create policy "avatar_select_public" on storage.objects for select
  using (bucket_id = 'avatars');
create policy "board_cover_select_public" on storage.objects for select
  using (bucket_id = 'board-covers');

-- "Not interested" — dismissing a product removes it from that user's feed
-- permanently and is meant to inform future ranking (the brand/category
-- columns are denormalized here for that reason, not just for dedup).
create table public.not_interested (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  product_id text not null,
  brand      text,
  category   text,
  created_at timestamptz default now(),
  unique (user_id, product_id)
);
create index on public.not_interested(user_id);

alter table public.not_interested enable row level security;
create policy "not_interested_read"   on public.not_interested for select using (auth.uid() = user_id);
create policy "not_interested_insert" on public.not_interested for insert with check (auth.uid() = user_id);
create policy "not_interested_delete" on public.not_interested for delete using (auth.uid() = user_id);

-- Cleanup: a non-product line item that scraped in as if it were real
-- merchandise (Rikumo's checkout add-on), and three literal books that
-- don't belong in a fashion/home/beauty catalog regardless of which brand
-- sells them. catalog-intake is being updated to filter both patterns out
-- going forward — this just clears what already got in.
delete from public.products where id = 'rikumo-free-returns-package-protection';
delete from public.products where id in (
  'tannergoods-mushroom-book-and-tool-combo',
  'tannergoods-edible-mushrooms-book',
  'or-e-new-york-the-artist-book'
);
