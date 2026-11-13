-- ----------------------------------------------------------------
-- Trove – rank_products_for_user: fixed work per call (#125)
-- Run in: Dashboard → SQL Editor → New query → Run  (after 036),
-- then `vacuum analyze public.products;` as a separate query.
-- ----------------------------------------------------------------

-- Symptom (2026-11-13): 57014 statement timeouts are back on every
-- signed-in feed load, so the app falls back to the unranked feed.
--
-- Diagnosis (read-only, production, 2026-11-13, as `authenticated`):
--   • rank_products_for_user: 8.2s total (`authenticated` times out at 8s).
--   • 032's nearest-150 step is an index-only scan over ALL 150,402 active
--     products in products_rank_idx, though only 26,529 have an
--     embedding. 78k heap fetches, 6.2s.
--   • 032's scoring pass scans all 150k again to draw its 4% sample.
--     75k heap fetches, 19.6s in that run.
--   • products is only 56% all-visible, with 20k dead tuples, after the
--     blurhash backfill rewrote most rows. Index-only scans only skip the
--     heap on all-visible pages.
-- 032 was tuned at 48k products and does work proportional to the
-- catalog, twice per call, which also depends on a fresh visibility map.
-- Neither holds at 167k with backfills running.
--
-- Fix: make per-call work independent of catalog size.
--   1. Nearest 150 from an HNSW index on embedding_bq (Hamming, active
--      products only). Only embedded products are in it, and a search
--      visits a bounded neighbourhood of the graph, not every row.
--   2. The discovery sample is a fixed 2,000 products: a run of
--      consecutive entries in hash(id) order, from a random start, on a
--      narrow partial index. Hash order is unrelated to brand or intake
--      order, so it is spread across brands like bernoulli, but it reads
--      ~2,000 entries instead of scanning the catalog. 2,000 is about what
--      bernoulli(4) gave at ~50k products, when ranking last worked. At
--      today's 150k, 4% would be 6,000, for a feed that returns 500.
--   3. Scoring reads those ≤2,150 rows by primary key; embedding_bq is
--      inline in the heap row, so nothing is detoasted. The scoring formula
--      is unchanged from 032.
--   4. products_rank_idx (27MB, 032) is dropped, because nothing reads it now.
--   5. Autovacuum on products triggers at 2% changed rows instead of 20%,
--      so bulk jobs (refresh, backfills) can't leave tens of thousands of
--      dead rows behind for long.
--
-- Measured locally (167k products, 150k active, 30k embedded, buffers
-- touched per call, as `authenticated`):
--   after a backfill-style rewrite of 90% of rows, no vacuum: 032 ~113k, 037 ~24k
--   vacuumed:                                                         037 ~21k
--   catalog doubled to 317k active:                                   037 ~22k
-- What's left is the taste vector (~4k), the HNSW search (~5k), the sample
-- (~2k) and ~2,150 primary-key reads for scoring.
--
-- The statement timeout is not raised.

alter table public.products set (
  autovacuum_vacuum_scale_factor = 0.02,
  autovacuum_vacuum_insert_scale_factor = 0.02,
  autovacuum_analyze_scale_factor = 0.02
);

-- HNSW returns at most ef_search rows per scan; the function sets it to
-- 150 for its one query, as 030 did.
create index if not exists products_embedding_bq_idx
  on public.products using hnsw (embedding_bq bit_hamming_ops)
  where status = 'active';

create index if not exists products_sample_idx
  on public.products ((hashtext(id)))
  where status = 'active';

-- The fixed-size discovery sample (step 2): p_n active product ids in hash
-- order from a random start, wrapping round to the lowest hashes at the end.
-- SECURITY DEFINER because under RLS (rank_products_for_user runs as
-- `authenticated`) Postgres won't use `hashtext(id) >= x` as an index
-- condition: hashtext isn't leakproof, so it has to filter row by row, which
-- is a scan again. It returns only ids of active products, which are
-- public anyway (policy products_read).
create or replace function public.sample_active_product_ids(p_n int)
returns text[]
language plpgsql
volatile  -- random()
security definer
set search_path = ''
as $$
declare
  v_start int := floor(random() * 4294967296 - 2147483648)::int;
  v_ids   text[];
begin
  select array_agg(s.id) into v_ids from (
    (select ps.id from public.products ps
     where ps.status = 'active' and hashtext(ps.id) >= v_start
     order by hashtext(ps.id) limit p_n)
    union all
    (select ps.id from public.products ps
     where ps.status = 'active' and hashtext(ps.id) < v_start
     order by hashtext(ps.id) limit p_n)
    limit p_n
  ) s;
  return v_ids;
end;
$$;

revoke execute on function public.sample_active_product_ids(int) from public, anon;
grant execute on function public.sample_active_product_ids(int) to authenticated, service_role;

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
volatile  -- random(); was mislabelled stable
as $$
declare
  taste_vector          vector(1024);
  v_taste_bq            bit(1024);
  v_shop_for            text[];
  v_taste_categories    text[];
  v_taste_brands        text[];
  v_taste_styles        text[];
  v_ni_brands           text[];
  v_excluded_brand_ids  uuid[];
  v_nearest             text[];
  v_sample              text[];
  -- Fixed, so per-call work doesn't grow with the catalog (see top of file).
  c_sample_size constant int := 2000;
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

  -- Unchanged from 030: the taste vector is averaged at full precision
  -- (~400 embeddings at most), then quantized once.
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


  -- Nearest 150 via products_embedding_bq_idx. ef_search is set at runtime,
  -- transaction-local: Supabase refuses it as a function SET clause. If
  -- it's refused here too, carry on with the default (40 candidates).
  if taste_vector is not null then
    v_taste_bq := binary_quantize(taste_vector)::bit(1024);
    begin
      perform set_config('hnsw.ef_search', '150', true);
    exception when others then
      null;
    end;
    select array_agg(nn.id) into v_nearest
    from (
      select pn.id from public.products pn
      where pn.status = 'active'
      order by pn.embedding_bq <~> v_taste_bq
      limit 150
    ) nn;
  end if;

  v_sample := public.sample_active_product_ids(c_sample_size);

  return query
  with pool as (
    select unnest(coalesce(v_nearest, '{}'::text[])) as id
    union
    select unnest(coalesce(v_sample, '{}'::text[]))
  ),
  scored as (
    select
      pr.id, pr.brand_id, pr.brand, pr.name, pr.price, pr.image, pr.ratio,
      pr.url, pr.category, pr.styles, pr.description, pr.source,
      pr.external_handle, pr.status, pr.first_seen_at, pr.last_seen_at,
      pr.price_history, pr.removed_at, pr.created_at, pr.search_keywords,
      pr.images, pr.prices,
      (
        -- Hamming distance on the cosine-distance scale (see 032).
        coalesce(
          case when v_taste_bq is not null and pr.embedding_bq is not null
            then -(1 - cos(pi() * (pr.embedding_bq <~> v_taste_bq) / 1024)) else 0 end,
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

drop index if exists public.products_rank_idx;

notify pgrst, 'reload schema';

-- Benchmark, run the way the app calls it: as `authenticated`, with RLS
-- on and the user's JWT subject set, so the editor's numbers match the app,
-- unlike 028/030's `postgres` runs. It times the three users with the
-- most taste signal. Anything well under 8000 ms is inside
-- `authenticated`'s statement timeout.
create or replace function pg_temp.time_rank(uid uuid) returns int
language plpgsql as $b$
declare t0 timestamptz; n int;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('role', 'authenticated', true);
  t0 := clock_timestamp();
  select count(*) into n from public.rank_products_for_user(uid);
  perform set_config('role', 'postgres', true);
  return round(extract(epoch from clock_timestamp() - t0) * 1000);
end $b$;

select s.user_id, s.signals, pg_temp.time_rank(s.user_id) as ms
from (
  select user_id, count(*) as signals from (
    select b.user_id from public.board_items bi join public.boards b on b.id = bi.board_id
    union all select user_id from public.brand_follows
    union all select user_id from public.product_views
  ) x group by user_id order by count(*) desc limit 3
) s;
