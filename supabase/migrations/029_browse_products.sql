-- ----------------------------------------------------------------
-- Trove – brand-balanced random feed for signed-out users and fallback
-- Run in: Dashboard → SQL Editor → New query → Run  (after 028)
-- ----------------------------------------------------------------

-- The unranked feed (signed-out, and signed-in whenever ranking fails)
-- was "the 1,000 newest active products" — PostgREST caps a plain select
-- at 1,000 rows. That was only ever varied by luck: the full-catalog
-- backfill (2026-09-26) walks brands alphabetically and paused around F/G,
-- so the 1,000 newest rows were all F/G brands (Ferm Living alone added
-- ~3,000) and that's all anyone on this path saw.
--
-- browse_products returns a random sample of the whole active catalog
-- with at most p_per_brand products per brand, so no single brand or
-- intake batch can dominate. BERNOULLI (row-level), not SYSTEM: rows sit
-- in intake order, one brand at a time, so block sampling comes back in
-- same-brand clumps. 6% of ~46k is ~2,700 candidates before the cap.
create or replace function public.browse_products(p_limit int default 600, p_per_brand int default 8)
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
  images          text[],
  prices          jsonb
)
language sql
volatile  -- random(); must not be treated as cacheable
as $$
  select
    s.id, s.brand_id, s.brand, s.name, s.price, s.image, s.ratio, s.url,
    s.category, s.styles, s.description, s.source, s.external_handle, s.status,
    s.first_seen_at, s.last_seen_at, s.price_history, s.removed_at, s.created_at,
    s.search_keywords, s.images, s.prices
  from (
    select pr.*, row_number() over (partition by pr.brand_id order by random()) as brand_rank
    from public.products pr tablesample bernoulli (6)
    where pr.status = 'active'
  ) s
  where s.brand_rank <= p_per_brand
  order by random()
  limit p_limit;
$$;

notify pgrst, 'reload schema';

-- Self-check: how many products and distinct brands one call returns.
select count(*) as products, count(distinct brand_id) as brands from public.browse_products();
