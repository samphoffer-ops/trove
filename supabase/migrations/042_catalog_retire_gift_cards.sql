-- ----------------------------------------------------------------
-- Trove – retire gift cards (#134)
-- Run in: Dashboard → SQL Editor → New query → Run  (after 041)
-- ----------------------------------------------------------------

-- One-off data cleanup to go with the catalog-intake fix in #134, which
-- stops gift cards and same-page duplicates from coming in again. Rows
-- are retired the way a refresh retires them (status 'removed'), not
-- deleted, so boards that saved one keep working. 041's trigger drops
-- them from product_search. Same patterns as EXCLUDED_PRODUCT_PATTERNS
-- (\m and \M are Postgres's word boundaries).
update public.products
set status = 'removed', removed_at = now()
where status = 'active'
  and (
       name ~* 'gift\s*-?\s*cards?\M'
    or name ~* '\me-?gift\M'
    or name ~* 'gift certificates?\M'
    or name ~* 'gift vouchers?\M'
  );

-- Same-page duplicates (27,139 rows across 140 brands on 2026-11-14) are
-- not retired here. Doing them in one statement outlived the dashboard's
-- connection and rolled back. Each brand's daily refresh retires its own
-- instead, via refreshBrand's same-URL check (#134), a few hundred rows
-- at a time.
