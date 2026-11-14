-- ----------------------------------------------------------------
-- Trove – index for paging a brand's products by id (#164)
-- Run in: Dashboard → SQL Editor → New query → Run  (after 042)
-- ----------------------------------------------------------------

-- catalog-intake's loadExistingProducts reads a brand's rows 1,000 at a
-- time ordered by id. With only the plain brand_id index, every page
-- re-read and re-sorted all of the brand's rows, which timed out for
-- Sabre Paris (5,613 products) and stopped its refresh. On (brand_id, id)
-- each page is a short ordered index read. It also serves everything the
-- brand_id-only index did, so that one is dropped.

create index if not exists products_brand_id_id_idx on public.products (brand_id, id);

drop index if exists public.products_brand_id_idx;
