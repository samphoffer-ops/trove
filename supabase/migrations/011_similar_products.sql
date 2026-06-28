-- ----------------------------------------------------------------
-- Trove – similar products on the product detail screen
-- Run in: Dashboard → SQL Editor → New query → Run
-- ----------------------------------------------------------------

-- Given a product, finds other active products with the closest embedding
-- (cosine distance) — same pgvector mechanism as rank_products_for_user,
-- just seeded from one product's embedding instead of a user's taste
-- vector. Returns nothing if the seed product has no embedding yet (still
-- being backfilled) rather than falling back to something arbitrary —
-- the product screen treats an empty result as "don't show this section."
create or replace function public.similar_products(p_product_id text, p_limit int default 12)
returns setof public.products
language sql
stable
as $$
  select p.*
  from public.products p, public.products seed
  where seed.id = p_product_id
    and seed.embedding is not null
    and p.id != p_product_id
    and p.status = 'active'
    and p.embedding is not null
  order by p.embedding <=> seed.embedding
  limit p_limit;
$$;
