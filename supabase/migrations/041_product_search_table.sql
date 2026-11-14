-- ----------------------------------------------------------------
-- Trove – search reads a narrow table, not products (#63)
-- Run in: Dashboard → SQL Editor → New query → Run  (after 039)
-- ----------------------------------------------------------------

-- 039 put search on a GIN index, and the index was used, but search still
-- timed out in production (2026-11-14). "jacket" matches 10,655 active
-- products, and ranking them meant reading every one of those wide rows
-- from the products heap: 3,127 pages from disk, 7.6s, past anon's 3s.
--
-- Fix: product_search holds just id, tsvector and last_seen_at for each
-- active product (~150k narrow rows, small enough to stay cached).
-- Ranking happens there, and only the top p_limit products are read from
-- products, by primary key. A trigger on products keeps it in sync:
-- active rows are upserted, anything else is removed. 039's expression
-- index on products is dropped, since nothing queries it now.

create table if not exists public.product_search (
  id           text primary key references public.products(id) on delete cascade,
  doc          tsvector not null,
  last_seen_at timestamptz
);

-- Read only through search_products (security definer below).
alter table public.product_search enable row level security;

create or replace function public.sync_product_search()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'active' then
    insert into public.product_search (id, doc, last_seen_at)
    values (new.id, public.products_search_doc(new.brand, new.name, new.search_keywords), new.last_seen_at)
    on conflict (id) do update set doc = excluded.doc, last_seen_at = excluded.last_seen_at;
  else
    delete from public.product_search where id = new.id;
  end if;
  return null;
end;
$$;

drop trigger if exists products_sync_search on public.products;
create trigger products_sync_search
  after insert or update of brand, name, search_keywords, status, last_seen_at on public.products
  for each row execute function public.sync_product_search();

insert into public.product_search (id, doc, last_seen_at)
select p.id, public.products_search_doc(p.brand, p.name, p.search_keywords), p.last_seen_at
from public.products p
where p.status = 'active'
on conflict (id) do update set doc = excluded.doc, last_seen_at = excluded.last_seen_at;

create index if not exists product_search_doc_idx on public.product_search using gin (doc);

drop index if exists public.products_search_doc_idx;

-- Same signature and columns as 039, so no drop needed.
create or replace function public.search_products(q text, p_limit int default 200)
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
security definer
set search_path = ''
as $$
  with hits as (
    select ps.id,
           row_number() over (order by ts_rank(ps.doc, tsq) desc, ps.last_seen_at desc) as rn
    from public.product_search ps,
         public.products_search_query(q) tsq
    where tsq is not null and ps.doc @@ tsq
    order by rn
    limit least(greatest(p_limit, 1), 200)
  )
  select
    pr.id, pr.brand_id, pr.brand, pr.name, pr.price, pr.image, pr.ratio,
    pr.url, pr.category, pr.styles, pr.description, pr.source, pr.external_handle,
    pr.status, pr.first_seen_at, pr.last_seen_at, pr.price_history, pr.removed_at,
    pr.created_at, pr.search_keywords, pr.images, pr.prices, pr.blurhash
  from hits
  join public.products pr on pr.id = hits.id
  where pr.status = 'active'
  order by hits.rn;
$$;
