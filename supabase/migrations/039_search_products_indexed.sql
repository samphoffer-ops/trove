-- ----------------------------------------------------------------
-- Trove – search_products on an index (#63)
-- Run in: Dashboard → SQL Editor → New query → Run
-- ----------------------------------------------------------------

-- 020's search_products matches '%q%' against name, brand and every
-- search_keywords element. No index can serve a leading-wildcard ilike,
-- so each call reads every active row. At ~150k active products that's
-- past anon's 3s statement timeout: on 2026-11-14 "jacket", "denim" and
-- "18 east" all failed with 57014, so search returned nothing at all.
--
-- Fix: full-text search over one tsvector per product (brand weighted
-- above name, name above keywords), backed by a GIN expression index on
-- active rows. Each query word becomes a prefix term ANDed together, so
-- typing "jack" matches "jacket" and "18 east" matches the brand in any
-- word order. 'english' stems both sides, so "jackets" finds "jacket".
-- Results come back by relevance, then newest. Also returns blurhash,
-- which 033 left out of search (#108).
--
-- An expression index, not a stored column, so nothing rewrites the
-- products table. The expression has to match the index exactly, which
-- is why both go through products_search_doc().

create or replace function public.products_search_doc(p_brand text, p_name text, p_keywords text[])
returns tsvector
language sql
immutable
parallel safe
as $$
  select setweight(to_tsvector('english'::regconfig, coalesce(p_brand, '')), 'A')
      || setweight(to_tsvector('english'::regconfig, coalesce(p_name, '')), 'B')
      || setweight(to_tsvector('english'::regconfig, coalesce(array_to_string(p_keywords, ' '), '')), 'C');
$$;

create index if not exists products_search_doc_idx
  on public.products using gin (public.products_search_doc(brand, name, search_keywords))
  where status = 'active';

-- Words → 'word:* & word:*'. Anything that isn't a letter or digit splits
-- words, so quotes, colons and other tsquery syntax can't get through.
-- Returns null when there's nothing searchable.
create or replace function public.products_search_query(q text)
returns tsquery
language sql
immutable
as $$
  select case when count(*) = 0 then null
              else to_tsquery('english'::regconfig, string_agg(w || ':*', ' & '))
         end
  from unnest(regexp_split_to_array(lower(coalesce(q, '')), '[^[:alnum:]]+')) w
  where w <> '';
$$;

-- Return type changes (blurhash), so drop first.
drop function if exists public.search_products(text, int);

create function public.search_products(q text, p_limit int default 200)
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
stable
as $$
  with query as (select public.products_search_query(q) as tsq)
  select
    pr.id, pr.brand_id, pr.brand, pr.name, pr.price, pr.image, pr.ratio,
    pr.url, pr.category, pr.styles, pr.description, pr.source, pr.external_handle,
    pr.status, pr.first_seen_at, pr.last_seen_at, pr.price_history, pr.removed_at,
    pr.created_at, pr.search_keywords, pr.images, pr.prices, pr.blurhash
  from public.products pr, query
  where pr.status = 'active'
    and query.tsq is not null
    and public.products_search_doc(pr.brand, pr.name, pr.search_keywords) @@ query.tsq
  order by ts_rank(public.products_search_doc(pr.brand, pr.name, pr.search_keywords), query.tsq) desc,
           pr.last_seen_at desc
  limit least(greatest(p_limit, 1), 200);
$$;
