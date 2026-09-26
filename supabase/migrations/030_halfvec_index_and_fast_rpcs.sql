-- ----------------------------------------------------------------
-- Trove – half-precision vector index; faster ranking, similar, browse
-- Run in: Dashboard → SQL Editor → New query → Run  (after 029)
-- ----------------------------------------------------------------

-- Diagnosis (2026-09-26, read-only timing script against production):
--  • rank_products_for_user's nearest-neighbour step alone took 1.6s. The
--    plan was a proper HNSW index scan — the index is simply big (151MB of
--    1024-dim float32 for only 19,159 embedded products so far; ~26,700
--    more are still being backfilled, which would take it to ~360MB) and
--    reading ef_search=400 candidates from it is I/O-bound.
--  • Everything else in ranking was fast: taste vector 143ms, random 4%
--    sample 53ms, distance scoring 83ms.
--
-- Fix: index a half-precision (halfvec, pgvector 0.8) cast of embedding
-- instead — half the size, so it has a real chance of staying in memory —
-- and ask it for 150 candidates, not 400. Recall loss from float16 is
-- negligible for picking a candidate pool that then gets re-scored at full
-- precision. The old full-precision index is dropped: every query that
-- used it moves to the new one below, and one vector index instead of two
-- keeps product writes (the backfill, the daily refresh) cheaper.
create index if not exists products_embedding_half_idx
  on public.products using hnsw ((embedding::halfvec(1024)) halfvec_cosine_ops);
drop index if exists public.products_embedding_idx;

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
as $$
declare
  taste_vector          vector(1024);
  v_shop_for            text[];
  v_taste_categories    text[];
  v_taste_brands        text[];
  v_taste_styles        text[];
  v_ni_brands           text[];
  v_excluded_brand_ids  uuid[];
  v_nearest             text[];
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
    -- A followed brand contributes its 25 newest products, not its whole
    -- catalog: with full catalogs one follow can mean 1,000+ embeddings
    -- to average (Drake's is 1,380), which is what made this time out.
    select pr.id
    from public.brand_follows bf
    cross join lateral (
      select p2.id from public.products p2
      where p2.brand_id = bf.brand_id and p2.status = 'active' and p2.embedding is not null
      order by p2.created_at desc
      limit 25
    ) pr
    cross join generate_series(1, 3)
    where bf.user_id = p_user_id
    union all
    -- Most recent 300 views — plenty of signal, bounded cost.
    select pv.product_id
    from (
      select product_id from public.product_views
      where user_id = p_user_id
      order by viewed_at desc nulls last
      limit 300
    ) pv
  )
  select avg(p.embedding) into taste_vector
  from weighted_signals ws
  join public.products p on p.id = ws.product_id
  where p.embedding is not null;

  -- Nearest neighbours as their own statement, ORDER BY distance LIMIT n
  -- with no other filters, against the half-precision index (see top of
  -- migration 030). Measured before 030: this one step was 1.6s of a
  -- 1.2-1.6s+ ranking — a 151MB full-precision index read with ef_search
  -- 400. Now 150 candidates from a half-size index; the random sample
  -- below still guarantees discovery beyond them. Removed products are
  -- filtered out by the join below.
  --
  -- HNSW returns at most ef_search rows per scan (default 40). Set at
  -- runtime, transaction-local — Supabase refuses it as a function SET
  -- clause. If it's refused here too, carry on with the default.
  if taste_vector is not null then
    begin
      perform set_config('hnsw.ef_search', '150', true);
    exception when others then
      null;
    end;
    select array_agg(nn.id) into v_nearest
    from (
      select pn.id from public.products pn
      order by pn.embedding::halfvec(1024) <=> taste_vector::halfvec(1024)
      limit 150
    ) nn;
  end if;

  return query
  with pool as (
    select unnest(coalesce(v_nearest, '{}'::text[])) as id
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
    where pr.status = 'active'
      and pr.id not in (select product_id from public.not_interested where user_id = p_user_id)
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

-- similar_products (product detail "You might also like"): took the seed
-- vector from a join, which the planner can't serve from an HNSW index —
-- i.e. every product view computed ~46k distances — and returned
-- `embedding` for all 12 rows. Now reads the seed vector first, then does
-- a plain ORDER BY distance LIMIT against the half-precision index.
create or replace function public.similar_products(p_product_id text, p_limit int default 12)
returns setof public.products
language plpgsql
stable
as $$
declare
  seed_vec halfvec(1024);
begin
  select sp.embedding::halfvec(1024) into seed_vec from public.products sp where sp.id = p_product_id;
  if seed_vec is null then return; end if; -- not embedded yet → no section
  return query
  select p.* from (
    select pn.id from public.products pn
    order by pn.embedding::halfvec(1024) <=> seed_vec
    limit p_limit * 3 + 1 -- headroom: the seed itself and inactive rows are filtered below
  ) nn
  join public.products p on p.id = nn.id
  where p.id <> p_product_id and p.status = 'active'
  order by p.embedding::halfvec(1024) <=> seed_vec
  limit p_limit;
end;
$$;

-- browse_products: carried every column (including the ~4KB embedding)
-- through its window-function sort; 2.1-3.6s against anon's 3s limit.
-- The random sample itself measured 53ms. Pick ids first, fetch full rows
-- for the final 600 only.
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
  with picked as (
    select s.id from (
      select ps.id, row_number() over (partition by ps.brand_id order by random()) as brand_rank
      from public.products ps tablesample bernoulli (6)
      where ps.status = 'active'
    ) s
    where s.brand_rank <= p_per_brand
    order by random()
    limit p_limit
  )
  select
    pr.id, pr.brand_id, pr.brand, pr.name, pr.price, pr.image, pr.ratio, pr.url,
    pr.category, pr.styles, pr.description, pr.source, pr.external_handle, pr.status,
    pr.first_seen_at, pr.last_seen_at, pr.price_history, pr.removed_at, pr.created_at,
    pr.search_keywords, pr.images, pr.prices
  from picked join public.products pr on pr.id = picked.id;
$$;

notify pgrst, 'reload schema';

-- Benchmark: each function timed in this session (first call includes
-- any cold-cache cost). Well under 3000 ms = inside the API timeout.
create or replace function pg_temp.time_ms(sql text) returns int
language plpgsql as $b$
declare t0 timestamptz := clock_timestamp(); n int;
begin
  execute sql into n;
  return round(extract(epoch from clock_timestamp() - t0) * 1000);
end $b$;

select 'rank (38-signal user)' as call, pg_temp.time_ms($q$select count(*) from public.rank_products_for_user('f82c715b-5949-47af-8732-dc8a30af884d')$q$) as ms
union all
select 'rank (6-signal user)', pg_temp.time_ms($q$select count(*) from public.rank_products_for_user('f0c83430-8e1d-4302-972f-ebf2684b1f61')$q$)
union all
select 'browse_products', pg_temp.time_ms($q$select count(*) from public.browse_products()$q$)
union all
select 'similar_products', pg_temp.time_ms($q$select count(*) from public.similar_products((select id from public.products where embedding is not null and status = 'active' limit 1))$q$);
