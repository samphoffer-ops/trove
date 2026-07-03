-- rank_products_for_user's explicit SELECT list was written before the
-- `images` column was added (migration 014). PostgreSQL enforces that the
-- body must return every column in `setof public.products`, so logged-in
-- users got a type-mismatch error and saw zero products. Adding images here.
create or replace function public.rank_products_for_user(p_user_id uuid, p_limit int default 2000)
returns setof public.products
language plpgsql
stable
as $$
declare
  taste_vector vector(1024);
  v_shop_for text[];
begin
  select shop_for into v_shop_for from public.profiles where id = p_user_id;

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
        + case when exists (
            select 1 from public.profiles prof
            where prof.id = p_user_id
              and (
                pr.category = any(prof.taste_categories)
                or lower(regexp_replace(pr.brand, '[^a-zA-Z0-9]+', '-', 'g')) = any(prof.taste_brands)
                or pr.styles && prof.taste_styles
              )
          ) then 1 else 0 end
        + case when v_shop_for is not null and array_length(v_shop_for, 1) > 0
            and exists (
              select 1 from public.brands b2
              where b2.id = pr.brand_id and b2.audience is not null
                and b2.audience <> 'unisex' and not (b2.audience = any(v_shop_for))
            ) then -2 else 0 end
        + case when exists (
            select 1 from public.not_interested ni
            where ni.user_id = p_user_id and ni.brand = pr.brand
          ) then -3 else 0 end
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
    scored.removed_at, scored.created_at, scored.embedding,
    scored.search_keywords, scored.images
  from scored
  order by -ln(random()) / greatest(exp(scored.combined_score / 4.0), 0.001) asc
  limit p_limit;
end;
$$;
