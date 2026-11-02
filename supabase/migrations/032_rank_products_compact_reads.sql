-- ----------------------------------------------------------------
-- Trove – rank_products_for_user: score from one small index (#105)
-- Run in: Dashboard → SQL Editor → New query → Run  (after 031),
-- then `vacuum analyze public.products;` as a separate query.
-- ----------------------------------------------------------------

-- Symptom (2026-11-02, first run of the iPhone dev build): every signed-in
-- feed load fails with 57014 "canceling statement due to statement
-- timeout" and the app falls back to the unranked feed.
--
-- Diagnosis: 030's plan shapes are fine. The HNSW index is still used when
-- the RPC runs as `authenticated` with the products RLS filter (checked
-- with EXPLAIN ANALYZE). The problem is how much it reads. Reproduced
-- locally with 48k products at production row widths and counted shared
-- buffers per call, run as `authenticated`:
--   • taste vector                                         ~1.7k pages
--   • nearest 150 via the halfvec HNSW index (119MB)       ~5.8k pages
--   • pool: tablesample bernoulli(4) visits EVERY heap
--     page (~12k), then scoring detoasts ~1.9k 4KB
--     embeddings for the distance term (~5.5k)            ~23k  pages
--   total ≈ 35k pages ≈ 270MB per feed load.
-- 030's benchmarks ran warm, as `postgres`. The app's first load runs cold
-- on a small instance whose disk is throttled to its baseline after the
-- backfill and refresh jobs, and at that rate 270MB does not fit in
-- `authenticated`'s 8s statement timeout. It also grows with the catalog:
-- the heap scan grows with every column and row.
--
-- Fix: rank from one narrow covering index instead of the heap.
--   1. embedding_bq bit(1024): a binary-quantized copy of embedding, one
--      bit per dimension, 128 bytes. Voyage embeddings are trained to
--      survive binary quantization. A trigger keeps it in sync with every
--      write to embedding.
--   2. products_rank_idx: a partial btree on active products that carries
--      exactly what scoring reads (id, brand_id, brand, category, styles,
--      embedding_bq). That is ~250 bytes per product, ~10MB today, small
--      enough to stay in memory. Nearest neighbours (exact Hamming top 150)
--      and the bernoulli 4% sample are both index-only scans of it, with
--      no heap pages and no TOAST.
--   3. Scoring uses the Hamming distance mapped onto the cosine-distance
--      scale (1 - cos(π·h/1024)), so no 4KB embedding is detoasted. The
--      distance term's weight in combined_score is unchanged. It is a
--      small nudge (exp(score/4)) next to the taste, audience and
--      not-interested terms, which are all unchanged.
--   4. Only the final p_limit (500) rows are fetched from the heap, by
--      primary key, in ranked order.
-- The pool is the same as before: the 150 nearest plus a 4% sample.
-- Measured on the same local copy, cold shared buffers, as `authenticated`:
-- ~35k → ~10k pages touched, 20k → 3.9k read, 430 → 60ms. The largest
-- step left is the taste vector (unchanged, ~4k pages).
--
-- The statement timeout is not raised. The halfvec index stays, because
-- similar_products still uses it.

alter table public.products add column if not exists embedding_bq bit(1024);

create or replace function public.products_set_embedding_bq()
returns trigger
language plpgsql
as $$
begin
  new.embedding_bq := case when new.embedding is null then null
                           else binary_quantize(new.embedding)::bit(1024) end;
  return new;
end;
$$;

drop trigger if exists products_embedding_bq on public.products;
create trigger products_embedding_bq
  before insert or update of embedding on public.products
  for each row execute function public.products_set_embedding_bq();

-- One-off backfill. It rewrites each heap row once; the TOASTed embedding
-- itself is not copied. It reads every embedding once, so expect it to
-- take a minute or two on a throttled disk.
update public.products
set embedding_bq = binary_quantize(embedding)::bit(1024)
where embedding is not null and embedding_bq is null;

create index if not exists products_rank_idx
  on public.products (id) include (brand_id, brand, category, styles, embedding_bq)
  where status = 'active';

-- Index-only scans skip the heap only for pages the visibility map marks
-- all-visible, and the backfill just cleared that for every page. VACUUM
-- can't run inside the editor's transaction, so run
-- `vacuum analyze public.products;` as its own query right after this.
analyze public.products;

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

  -- Exact Hamming top 150: an index-only scan of products_rank_idx plus a
  -- top-N sort. No vector index is involved, so there is no ef_search to set.
  if taste_vector is not null then
    v_taste_bq := binary_quantize(taste_vector)::bit(1024);
    select array_agg(nn.id) into v_nearest
    from (
      select pn.id from public.products pn
      where pn.status = 'active' and pn.embedding_bq is not null
      order by pn.embedding_bq <~> v_taste_bq
      limit 150
    ) nn;
  end if;

  return query
  with scored as (
    -- One index-only pass over products_rank_idx: the nearest 150 plus a
    -- row-level 4% sample. Like 030's bernoulli(4), it spreads across
    -- brands, but it reads the ~10MB index instead of the whole heap.
    select
      c.id,
      (
        -- Hamming distance on the cosine-distance scale; see the top of the file.
        coalesce(
          case when v_taste_bq is not null and c.embedding_bq is not null
            then -(1 - cos(pi() * (c.embedding_bq <~> v_taste_bq) / 1024)) else 0 end,
          0
        )
        + case when
            c.category = any(v_taste_categories)
            or lower(regexp_replace(c.brand, '[^a-zA-Z0-9]+', '-', 'g')) = any(v_taste_brands)
            or c.styles && v_taste_styles
          then 1 else 0 end
        + case when c.brand_id = any(v_excluded_brand_ids) then -2 else 0 end
        + case when c.brand = any(v_ni_brands) then -3 else 0 end
      ) as combined_score
    from public.products c
    where c.status = 'active'
      and (c.id = any(v_nearest) or random() < 0.04)
      and c.id not in (select product_id from public.not_interested where user_id = p_user_id)
  ),
  picked as (
    select scored.id, -ln(random()) / greatest(exp(scored.combined_score / 4.0), 0.001) as sort_key
    from scored
    order by sort_key asc
    limit p_limit
  )
  -- Full rows for the final p_limit only, kept in ranked order.
  select
    pr.id, pr.brand_id, pr.brand, pr.name, pr.price, pr.image, pr.ratio, pr.url,
    pr.category, pr.styles, pr.description, pr.source, pr.external_handle, pr.status,
    pr.first_seen_at, pr.last_seen_at, pr.price_history, pr.removed_at, pr.created_at,
    pr.search_keywords, pr.images, pr.prices
  from picked
  join public.products pr on pr.id = picked.id
  order by picked.sort_key asc;
end;
$$;

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
