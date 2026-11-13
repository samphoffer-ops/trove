-- ----------------------------------------------------------------
-- #125 diagnostic: why rank_products_for_user times out at ~167k products
-- READ-ONLY. Run in: Dashboard → SQL Editor → New query → Run.
-- Each numbered block is its own query (the editor shows only the last
-- result), so select one block at a time and run it.
-- ----------------------------------------------------------------

-- 1. Visibility map, dead rows and vacuum history for products.
--    032's scans are index-only. They skip the heap only on all-visible
--    pages, so pct_all_visible near 100 is what 032 assumed.
select c.relpages, c.relallvisible,
       round(100.0 * c.relallvisible / greatest(c.relpages, 1), 1) as pct_all_visible,
       pg_size_pretty(pg_relation_size(c.oid)) as heap,
       s.n_live_tup, s.n_dead_tup, s.n_mod_since_analyze,
       s.last_vacuum, s.last_autovacuum, s.last_analyze, s.last_autoanalyze,
       s.n_tup_upd, s.n_tup_hot_upd
from pg_class c join pg_stat_user_tables s on s.relid = c.oid
where c.oid = 'public.products'::regclass;

-- 2. Index sizes (the rank index was ~27MB on 2026-11-13).
select indexrelid::regclass as index, pg_size_pretty(pg_relation_size(indexrelid)) as size
from pg_index where indrelid = 'public.products'::regclass
order by pg_relation_size(indexrelid) desc;

-- 3. Role timeouts, and how many products have embeddings.
select rolname, rolconfig from pg_roles where rolname in ('anon', 'authenticated');
select count(*) filter (where status = 'active') as active,
       count(*) filter (where status = 'active' and embedding_bq is not null) as active_embedded
from public.products;

-- 4. The two scans 032 runs on every call, with EXPLAIN (ANALYZE,
--    BUFFERS), run as `authenticated`. "Heap Fetches" close to the row
--    count means the index-only scan is really reading the heap.
create or replace function pg_temp.explain_rank() returns setof text
language plpgsql as $b$
declare q bit(1024); r text;
begin
  select binary_quantize(avg(embedding))::bit(1024) into q
  from (select embedding from public.products
        where status = 'active' and embedding is not null limit 50) s;
  perform set_config('role', 'authenticated', true);
  return next '--- nearest 150 (exact Hamming over products_rank_idx)';
  for r in execute
    'explain (analyze, buffers) select pn.id from public.products pn
     where pn.status = ''active'' and pn.embedding_bq is not null
     order by pn.embedding_bq <~> $1 limit 150' using q loop
    return next r;
  end loop;
  return next '--- scoring pass (4% sample over products_rank_idx)';
  for r in execute
    'explain (analyze, buffers) select c.id, (c.embedding_bq <~> $1) as h from public.products c
     where c.status = ''active'' and random() < 0.04' using q loop
    return next r;
  end loop;
  perform set_config('role', 'postgres', true);
end $b$;
select * from pg_temp.explain_rank();
