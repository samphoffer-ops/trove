-- ----------------------------------------------------------------
-- Trove – blurhash placeholders for product images (#108)
-- Run in: Dashboard → SQL Editor → New query → Run  (after 032).
-- Then deploy catalog-intake and run the backfill (see the PR).
-- ----------------------------------------------------------------

-- Spec §6: "Use expo-image with blurhash placeholders. Never show empty
-- gray boxes." The app shows this hash while a product's image loads.
-- It is computed from the product's primary image (`image`) by
-- catalog-intake, at refresh for new or changed images and by the
-- backfill_blurhash action for everything else. The image itself, and its
-- URL, are never changed.
--   null  not hashed yet (the backfill's queue)
--   ''    tried, no hash: dead link, or a host that only serves WebP.
--         The app shows its plain placeholder. A new image retries it.

alter table public.products add column if not exists blurhash text;

-- The backfill's queue. Partial, so it starts at ~146k entries and shrinks
-- to the handful a refresh couldn't hash in time; rows leave it as they
-- are written.
create index if not exists products_blurhash_todo_idx
  on public.products (id) where blurhash is null and status = 'active';

-- Bulk write for the backfill: { "<product id>": "<hash>", ... }. One
-- statement per call instead of one request per row. Service role only.
create or replace function public.set_product_blurhashes(p_hashes jsonb)
returns int
language sql
as $$
  with updated as (
    update public.products p set blurhash = h.value
    from jsonb_each_text(p_hashes) h
    where p.id = h.key
    returning 1
  )
  select count(*)::int from updated;
$$;

revoke execute on function public.set_product_blurhashes(jsonb) from public, anon, authenticated;
grant execute on function public.set_product_blurhashes(jsonb) to service_role;

-- The feed RPCs return a fixed column list, so they need blurhash added.
-- Bodies are 032's and 030's unchanged apart from the new last column.
-- A changed return type needs a drop first. similar_products returns
-- setof products and picks the column up by itself. search_products is
-- left alone (search is v1.1).

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
  prices          jsonb,
  blurhash        text
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
    pr.search_keywords, pr.images, pr.prices, pr.blurhash
  from picked
  join public.products pr on pr.id = picked.id
  order by picked.sort_key asc;
end;
$$;


drop function if exists public.browse_products(int, int);

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
  prices          jsonb,
  blurhash        text
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
    pr.search_keywords, pr.images, pr.prices, pr.blurhash
  from picked join public.products pr on pr.id = picked.id;
$$;


notify pgrst, 'reload schema';
