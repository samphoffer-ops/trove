-- ----------------------------------------------------------------
-- Trove – rank_products_for_user: sample without touching the heap (#125)
-- Run in: Dashboard → SQL Editor → New query → Run  (after 037),
-- then `vacuum analyze public.products;` as a separate query.
-- ----------------------------------------------------------------

-- 037 in production (2026-11-13, after vacuum): 2.8-3.2s per call, under
-- `authenticated`'s 8s timeout but with little headroom. Breakdown:
--   • nearest 150 via products_embedding_bq_idx: 0.54s (~2.1k buffers)
--   • sample_active_product_ids(2000): 2.3s. products_sample_idx holds
--     only hashtext(id), so each of the 2,000 sampled ids is a random read
--     of the 212MB heap, which doesn't fit in Nano's memory.
--   • scoring then reads those same ~2,150 rows by primary key again.
--
-- Fix: give the sample index the columns scoring needs, so the sample is
-- an index-only read of ~2,000 consecutive entries (a few dozen pages),
-- and fetch full heap rows only for the final p_limit (500) products.
-- Heap reads per call go from ~2,150 random rows to ~650 (150 nearest,
-- read by the HNSW scan anyway, plus the 500 returned).
--
-- products_sample_idx (hashtext only) is replaced by
-- products_sample_cover_idx, which is ~30MB, about what dropping
-- products_rank_idx freed in 037. sample_active_product_ids is replaced
-- by sample_active_products. The scoring formula and pool (nearest 150 +
-- 2,000 sample) are unchanged.

create index if not exists products_sample_cover_idx
  on public.products ((hashtext(id))) include (id, brand_id, brand, category, styles, embedding_bq)
  where status = 'active';

drop index if exists public.products_sample_idx;

-- Same sample as 037's sample_active_product_ids, returning the scoring
-- columns too. It's SECURITY DEFINER for the same reason: under RLS,
-- Postgres won't use `hashtext(id) >= x` as an index condition. It returns
-- only active products, which are public anyway (policy products_read).
create or replace function public.sample_active_products(p_n int)
returns table (
  id           text,
  brand_id     uuid,
  brand        text,
  category     text,
  styles       text[],
  embedding_bq bit(1024)
)
language plpgsql
volatile  -- random()
security definer
set search_path = ''
as $$
declare
  v_start int := floor(random() * 4294967296 - 2147483648)::int;
begin
  return query
  (select ps.id, ps.brand_id, ps.brand, ps.category, ps.styles, ps.embedding_bq
   from public.products ps
   where ps.status = 'active' and hashtext(ps.id) >= v_start
   order by hashtext(ps.id) limit p_n)
  union all
  (select ps.id, ps.brand_id, ps.brand, ps.category, ps.styles, ps.embedding_bq
   from public.products ps
   where ps.status = 'active' and hashtext(ps.id) < v_start
   order by hashtext(ps.id) limit p_n)
  limit p_n;
end;
$$;

revoke execute on function public.sample_active_products(int) from public, anon;
grant execute on function public.sample_active_products(int) to authenticated, service_role;

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

  return query
  with candidates as (
    -- The 150 nearest (their heap pages were just read by the HNSW scan)
    -- plus the 2,000-product sample (index-only), deduplicated by id.
    select distinct on (c.id) c.*
    from (
      select pr.id, pr.brand_id, pr.brand, pr.category, pr.styles, pr.embedding_bq
      from public.products pr
      where pr.id = any(coalesce(v_nearest, '{}'::text[])) and pr.status = 'active'
      union all
      select s.id, s.brand_id, s.brand, s.category, s.styles, s.embedding_bq
      from public.sample_active_products(c_sample_size) s
    ) c
  ),
  picked as (
    select
      cand.id,
      -ln(random()) / greatest(exp((
        -- Hamming distance on the cosine-distance scale (see 032).
        coalesce(
          case when v_taste_bq is not null and cand.embedding_bq is not null
            then -(1 - cos(pi() * (cand.embedding_bq <~> v_taste_bq) / 1024)) else 0 end,
          0
        )
        + case when
            cand.category = any(v_taste_categories)
            or lower(regexp_replace(cand.brand, '[^a-zA-Z0-9]+', '-', 'g')) = any(v_taste_brands)
            or cand.styles && v_taste_styles
          then 1 else 0 end
        + case when cand.brand_id = any(v_excluded_brand_ids) then -2 else 0 end
        + case when cand.brand = any(v_ni_brands) then -3 else 0 end
      ) / 4.0), 0.001) as sort_key
    from candidates cand
    where cand.id not in (select product_id from public.not_interested where user_id = p_user_id)
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

drop function if exists public.sample_active_product_ids(int);

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
