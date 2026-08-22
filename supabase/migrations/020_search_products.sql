-- ----------------------------------------------------------------
-- Trove – search was never a real search
-- Run in: Dashboard → SQL Editor → New query → Run
--
-- search.tsx filters over useProductsStore's `products` array using
-- name/brand/search_keywords substring matching -- but that array is
-- whatever rank_products_for_user's weighted-random sample happened to
-- pull for this user (capped at p_limit, a fraction of the ~13,666
-- active products), not the actual catalog. A low-signal brand with a
-- handful of products (no purchases/follows/views to boost it) has real
-- odds of landing outside that sample and being invisible to search no
-- matter how correctly its name is typed -- confirmed with "Vitos New
-- York", 6 products, absent from search results. Lowering
-- rank_products_for_user's default limit (migration 019, 2000 -> 500)
-- made this materially more likely to happen, but the underlying
-- problem predates that change: search was always filtering a sample,
-- never the catalog.
--
-- Fix: a dedicated function that searches every active product
-- directly, independent of any one user's ranked/sampled feed. Same
-- match semantics as the old client-side filter (name/brand substring,
-- or a search_keywords element substring) so search behavior doesn't
-- change from the user's perspective -- it just now actually covers the
-- whole catalog instead of whatever got sampled into memory.
-- ----------------------------------------------------------------

create or replace function public.search_products(q text, p_limit int default 200)
returns table (
  id              text,
  brand_id        uuid,
  brand           text,
  name            text,
  price           numeric(10, 2),
  image           text,
  ratio           numeric(5, 3),
  url             text,
  category        text,
  styles          text[],
  description     text,
  source          text,
  external_handle text,
  status          text,
  first_seen_at   timestamptz,
  last_seen_at    timestamptz,
  price_history   jsonb,
  removed_at      timestamptz,
  created_at      timestamptz,
  search_keywords text[],
  images          text[]
)
language sql
stable
as $$
  select
    pr.id, pr.brand_id, pr.brand, pr.name, pr.price, pr.image, pr.ratio,
    pr.url, pr.category, pr.styles, pr.description, pr.source, pr.external_handle,
    pr.status, pr.first_seen_at, pr.last_seen_at, pr.price_history, pr.removed_at,
    pr.created_at, pr.search_keywords, pr.images
  from public.products pr
  where pr.status = 'active'
    and (
      pr.name ilike '%' || q || '%'
      or pr.brand ilike '%' || q || '%'
      or exists (select 1 from unnest(pr.search_keywords) k where k ilike '%' || q || '%')
    )
  order by pr.last_seen_at desc
  limit p_limit;
$$;
