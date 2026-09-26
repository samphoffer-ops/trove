-- ----------------------------------------------------------------
-- Trove – feed performance at 45k products, country picker, search
-- Run in: Dashboard → SQL Editor → New query → Run  (after 024 and 025)
-- ----------------------------------------------------------------

-- ── Feed performance ────────────────────────────────────────────────
-- The full-catalog backfill (2026-09-26) took active products from ~19k to
-- ~46k, and both feed queries started hitting the statement timeout —
-- i.e. an empty feed for everyone:
--  • The unranked feed (signed-out, and the signed-in fallback) orders all
--    active products by created_at with no index to do it: 4.3s against
--    anon's 3s limit, vs 0.35s for the same query unsorted.
--  • rank_products_for_user scores every active product, including a
--    1024-dim cosine distance per row. Migration 019 already had to rescue
--    it at 13.6k rows; at 46k it times out even with no taste signal.
create index if not exists products_active_created_idx
  on public.products (created_at desc) where status = 'active';

-- The shopper's country (ISO 3166 alpha-2, e.g. 'US', 'GB'). Null means
-- "not chosen yet" — the app falls back to the device's region, then US.
alter table public.profiles add column if not exists country text;

-- rank_products_for_user and search_products return an explicit column
-- list, so products.prices (migration 024) never reached the app through
-- them. Both gain a `prices` column below — which is what lets a UK shopper
-- see a UK brand's real GBP price instead of a USD→GBP conversion. Changing
-- a RETURNS TABLE signature needs a drop first.
--
-- rank_products_for_user also changes shape (see "Feed performance" above):
-- instead of scoring every active product it scores a candidate pool —
-- the 1,000 products nearest the user's taste vector (via the existing
-- HNSW index, which is what it's for) plus a random ~4% of the whole
-- catalog, so there's always discovery beyond the user's taste and a
-- cold-start user (no taste vector) still gets a varied feed. The scoring
-- and weighted-random sampling over that pool are unchanged.
--
-- search_products: migration 020 was never applied to production (the RPC
-- 404s, so app search has been silently erroring), so this also creates it.

drop function if exists public.rank_products_for_user(uuid, int);

create or replace function public.rank_products_for_user(p_user_id uuid, p_limit int default 500)
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
language plpgsql
stable
-- HNSW returns at most ef_search rows per scan (default 40), so the
-- 1,000-nearest candidate query below needs it raised for this call.
set hnsw.ef_search = 1000
as $$
declare
  taste_vector          vector(1024);
  v_shop_for            text[];
  v_taste_categories    text[];
  v_taste_brands        text[];
  v_taste_styles        text[];
  v_ni_brands           text[];
  v_excluded_brand_ids  uuid[];
begin
  -- `prof.` qualification is required, not stylistic: RETURNS TABLE makes
  -- each output column (id, brand, name, ...) an implicit PL/pgSQL variable
  -- in scope for the whole function body, so a bare `id` here is ambiguous
  -- between that variable and profiles.id.
  select prof.shop_for, prof.taste_categories, prof.taste_brands, prof.taste_styles
    into v_shop_for, v_taste_categories, v_taste_brands, v_taste_styles
  from public.profiles prof where prof.id = p_user_id;

  select array_agg(ni.brand) into v_ni_brands
  from public.not_interested ni where ni.user_id = p_user_id;

  if v_shop_for is not null and array_length(v_shop_for, 1) > 0 then
    select array_agg(b2.id) into v_excluded_brand_ids
    from public.brands b2
    where b2.audience is not null and b2.audience <> 'unisex'
      and not (b2.audience = any(v_shop_for));
  end if;

  with weighted_signals as (
    select bi.product_id
    from public.board_items bi
    join public.boards b on b.id = bi.board_id
    cross join generate_series(1, 6)
    where b.user_id = p_user_id and bi.purchased_at is not null
    union all
    select bi.product_id
    from public.board_items bi
    join public.boards b on b.id = bi.board_id
    cross join generate_series(1, 2)
    where b.user_id = p_user_id and bi.purchased_at is null
    union all
    select pr.id
    from public.brand_follows bf
    join public.products pr on pr.brand_id = bf.brand_id
    cross join generate_series(1, 3)
    where bf.user_id = p_user_id
    union all
    select pv.product_id
    from public.product_views pv
    where pv.user_id = p_user_id
  )
  select avg(p.embedding) into taste_vector
  from weighted_signals ws
  join public.products p on p.id = ws.product_id
  where p.embedding is not null;

  return query
  with pool as (
    select nn.id from (
      select pn.id from public.products pn
      where taste_vector is not null and pn.status = 'active' and pn.embedding is not null
      order by pn.embedding <=> taste_vector
      limit 1000
    ) nn
    union
    -- BERNOULLI (row-level), not SYSTEM (block-level): rows are stored in
    -- intake order, one brand's catalog at a time, so a block sample would
    -- come back in same-brand clumps.
    select ps.id from public.products ps tablesample bernoulli (4)
    where ps.status = 'active'
  ),
  scored as (
    select
      pr.*,
      (
        coalesce(
          case when taste_vector is not null and pr.embedding is not null
            then -(pr.embedding <=> taste_vector) else 0 end,
          0
        )
        + case when
            pr.category = any(v_taste_categories)
            or lower(regexp_replace(pr.brand, '[^a-zA-Z0-9]+', '-', 'g')) = any(v_taste_brands)
            or pr.styles && v_taste_styles
          then 1 else 0 end
        + case when pr.brand_id = any(v_excluded_brand_ids) then -2 else 0 end
        + case when pr.brand = any(v_ni_brands) then -3 else 0 end
      ) as combined_score
    from pool
    join public.products pr on pr.id = pool.id
    where pr.id not in (select product_id from public.not_interested where user_id = p_user_id)
  )
  select
    scored.id, scored.brand_id, scored.brand, scored.name, scored.price,
    scored.image, scored.ratio, scored.url, scored.category, scored.styles,
    scored.description, scored.source, scored.external_handle, scored.status,
    scored.first_seen_at, scored.last_seen_at, scored.price_history,
    scored.removed_at, scored.created_at, scored.search_keywords, scored.images,
    scored.prices
  from scored
  order by -ln(random()) / greatest(exp(scored.combined_score / 4.0), 0.001) asc
  limit p_limit;
end;
$$;

drop function if exists public.search_products(text, int);

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
  images          text[],
  prices          jsonb
)
language sql
stable
as $$
  select
    pr.id, pr.brand_id, pr.brand, pr.name, pr.price, pr.image, pr.ratio,
    pr.url, pr.category, pr.styles, pr.description, pr.source, pr.external_handle,
    pr.status, pr.first_seen_at, pr.last_seen_at, pr.price_history, pr.removed_at,
    pr.created_at, pr.search_keywords, pr.images, pr.prices
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
