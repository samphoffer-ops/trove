-- ----------------------------------------------------------------
-- Trove – fix rank_products_for_user timing out for every logged-in user
-- Run in: Dashboard → SQL Editor → New query → Run
--
-- The catalog grew from ~50 brands'/1,475 products' worth to 178 brands /
-- 13,666 active products once the daily refresh cron actually started
-- covering the full approved list (see the three "refresh cron" commits).
-- rank_products_for_user scores every active product with three per-row
-- correlated EXISTS subqueries (against profiles, brands, not_interested)
-- and returns the full row including the embedding vector(1024) column,
-- none of which the app even reads. At the old catalog size that was slow
-- but survivable; at 13,666 rows it now reliably exceeds Postgres'
-- statement timeout, so productsRes.error fires on every load and
-- logged-in users see an empty feed. Confirmed directly against
-- production: the RPC times out (or nearly does, 3.5-4.7s) even for a
-- brand-new user with zero taste signal, i.e. before the pgvector
-- similarity math even runs -- the per-row subqueries and full-row
-- transfer alone are enough.
--
-- Fix: compute each user's taste signals (categories/brands/styles,
-- not-interested brands, shop_for-excluded brand ids) ONCE up front into
-- plain arrays, then score each row with cheap `= any(...)` membership
-- checks instead of a fresh correlated subquery per row. Also drop
-- `embedding` from the returned columns -- nothing in the app reads it
-- (see mobile/src/types/index.ts Product interface), and at ~4KB/row it
-- was the single largest thing being serialized back over the wire.
-- Lowered the default limit from 2000 to 500: the feed only ever shows
-- 30 at a time, growing by 30 as the user scrolls, so 2000 was mostly
-- just extra sort/serialize cost with no user-facing benefit.
-- ----------------------------------------------------------------

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
  images          text[]
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
  with scored as (
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
    from public.products pr
    where pr.status = 'active'
      and pr.id not in (select product_id from public.not_interested where user_id = p_user_id)
  )
  select
    scored.id, scored.brand_id, scored.brand, scored.name, scored.price,
    scored.image, scored.ratio, scored.url, scored.category, scored.styles,
    scored.description, scored.source, scored.external_handle, scored.status,
    scored.first_seen_at, scored.last_seen_at, scored.price_history,
    scored.removed_at, scored.created_at, scored.search_keywords, scored.images
  from scored
  order by -ln(random()) / greatest(exp(scored.combined_score / 4.0), 0.001) asc
  limit p_limit;
end;
$$;
