-- ----------------------------------------------------------------
-- Trove – rank_products_for_user: nearest neighbours via the HNSW index
-- Run in: Dashboard → SQL Editor → New query → Run  (after 027)
-- ----------------------------------------------------------------

-- After 027, users with taste signal still ranked in 3.2-3.9s (vs ~0.5s
-- for a user with none), so the bounded taste inputs weren't the main
-- cost. See the comment on v_nearest below. Same function otherwise.

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

  -- Nearest neighbours as their own statement, in the one shape the
  -- planner reliably serves from the HNSW index: ORDER BY distance LIMIT n
  -- with no other filters. In 026/027 this sat inside the main query with
  -- status/null filters and LIMIT 1000, and ranking still took 3-4s for
  -- real users while no-taste users took ~0.5s — consistent with the
  -- planner computing all ~46k distances instead of using the index.
  -- Removed products are filtered out by the join below instead.
  --
  -- HNSW returns at most ef_search rows per scan (default 40). Set at
  -- runtime, transaction-local — Supabase refuses it as a function SET
  -- clause. If it's refused here too, carry on with the default.
  if taste_vector is not null then
    begin
      perform set_config('hnsw.ef_search', '400', true);
    exception when others then
      null;
    end;
    select array_agg(nn.id) into v_nearest
    from (
      select pn.id from public.products pn
      order by pn.embedding <=> taste_vector
      limit 400
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

notify pgrst, 'reload schema';

-- Benchmark: times the new function for the three users with the most
-- taste signal, so the editor shows real numbers. Anything well under
-- 3000 ms is inside the API's timeout.
create or replace function pg_temp.time_rank(uid uuid) returns int
language plpgsql as $b$
declare t0 timestamptz := clock_timestamp(); n int;
begin
  select count(*) into n from public.rank_products_for_user(uid);
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
