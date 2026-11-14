-- ----------------------------------------------------------------
-- Trove – retire gift cards and same-page duplicates (#134)
-- Run in: Dashboard → SQL Editor → New query → Run  (after 041)
-- ----------------------------------------------------------------

-- One-off data cleanup to go with the catalog-intake fix in #134, which
-- stops both from coming in again. Rows are retired the way a refresh
-- retires them (status 'removed'), not deleted, so boards that saved one
-- keep working. 041's trigger drops them from product_search.

-- 1. Gift cards. Same patterns as EXCLUDED_PRODUCT_PATTERNS
--    (\m and \M are Postgres's word boundaries).
update public.products
set status = 'removed', removed_at = now()
where status = 'active'
  and (
       name ~* 'gift\s*-?\s*cards?\M'
    or name ~* '\me-?gift\M'
    or name ~* 'gift certificates?\M'
    or name ~* 'gift vouchers?\M'
  );

-- 2. Two or more active rows for the same brand and page URL. Keep the
--    row whose id is what both scrapes now produce (brand slug + the
--    URL's /products/<handle>, slugified as in catalog-intake), else the
--    most recently seen; retire the rest.
with ranked as (
  select
    p.id,
    row_number() over (
      partition by p.brand_id, p.url
      order by
        (p.id = trim(both '-' from regexp_replace(lower(p.brand), '[^a-z0-9]+', '-', 'g'))
                || '-' ||
                trim(both '-' from regexp_replace(lower(substring(p.url from '/products/([^/?#]+)')), '[^a-z0-9]+', '-', 'g'))
        ) desc nulls last,
        p.last_seen_at desc nulls last,
        p.id
    ) as rn
  from public.products p
  where p.status = 'active'
    and p.url in (
      select url from public.products
      where status = 'active'
      group by brand_id, url
      having count(*) > 1
    )
)
update public.products p
set status = 'removed', removed_at = now()
from ranked
where ranked.id = p.id and ranked.rn > 1;
