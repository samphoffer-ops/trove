-- ----------------------------------------------------------------
-- Trove – bound the taste-vector cost in rank_products_for_user
-- Run in: Dashboard → SQL Editor → New query → Run  (after 026)
-- ----------------------------------------------------------------

-- After 026, a user with no taste signal ranks in ~0.5s, but real users
-- still hit 2.3-5.7s: the taste vector averages the embedding of every
-- product of every followed brand (x3 weight). That was already the
-- heaviest part at 19k products; with full catalogs a single follow can
-- pull in 1,000+ 1024-dim vectors. Same function as 026 otherwise.

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

  -- HNSW returns at most ef_search rows per scan (default 40), so the
  -- 1,000-nearest candidate query below needs it raised for this call.
  -- Set at runtime, transaction-local: Supabase refuses it as a function
  -- SET clause ("permission denied to set parameter"), since pgvector's
  -- library isn't loaded at CREATE time. By this point a non-null
  -- taste_vector means pgvector is loaded and the setting is an ordinary
  -- user-settable one. If it's still refused, carry on with the default —
  -- a smaller nearest-neighbour pool, not a failed feed.
  if taste_vector is not null then
    begin
      perform set_config('hnsw.ef_search', '1000', true);
    exception when others then
      null;
    end;
  end if;

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

notify pgrst, 'reload schema';

select '027 applied' as status;
