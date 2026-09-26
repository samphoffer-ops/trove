-- ----------------------------------------------------------------
-- Trove – catalog coverage check
-- Run in: Dashboard → SQL Editor → New query → Run  (after 024)
-- ----------------------------------------------------------------

-- Approved brands used to fail silently: a brand could sit at 2 of its 439
-- products (Schott) or 0 (six brands) for weeks and nothing said so. Every
-- scrape now records what the store actually had vs. what we saved, and the
-- brand_coverage view below flags any approved brand that falls short —
-- checked by the daily refresh workflow and the admin section in Settings.
alter table public.brands add column if not exists last_scrape_at    timestamptz;
alter table public.brands add column if not exists last_scrape_found int;   -- in-stock products the store had (for ld_json: in this run's window)
alter table public.brands add column if not exists last_scrape_saved int;   -- rows we successfully wrote
alter table public.brands add column if not exists last_scrape_error text;  -- null when the last scrape was clean

-- One row per approved brand, with a human-readable reason when its
-- coverage needs a look. security_invoker so it respects RLS for anon
-- callers (who can't see scrape internals anyway); catalog-intake reads it
-- with the service-role key.
create or replace view public.brand_coverage with (security_invoker = true) as
select
  b.id, b.name, b.domain, b.platform, b.last_scrape_at,
  b.last_scrape_found, b.last_scrape_saved, b.last_scrape_error,
  coalesce(p.active_count, 0) as active_count,
  case
    when b.last_scrape_at is null                            then 'never scraped'
    when b.last_scrape_error is not null                     then 'last scrape failed: ' || b.last_scrape_error
    when b.last_scrape_at < now() - interval '48 hours'      then 'not refreshed in over 48h'
    when coalesce(b.last_scrape_found, 0) = 0                then 'store returned no in-stock products'
    -- ld_json only covers a window of the catalog per run, so the store's
    -- full size isn't known — only a Shopify brand can be "short".
    when b.platform = 'shopify'
     and coalesce(p.active_count, 0) < 0.9 * b.last_scrape_found
                                                             then 'only ' || coalesce(p.active_count, 0) || ' of ' || b.last_scrape_found || ' products live'
  end as problem
from public.brands b
left join (
  select brand_id, count(*) as active_count
  from public.products where status = 'active' group by brand_id
) p on p.brand_id = b.id
where b.status = 'approved';
