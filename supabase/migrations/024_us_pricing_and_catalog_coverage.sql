-- ----------------------------------------------------------------
-- Trove – US-first pricing, multi-currency groundwork, fuller catalogs
-- Run in: Dashboard → SQL Editor → New query → Run
-- ----------------------------------------------------------------

-- products.price has always been rendered with a hard-coded "$", but it was
-- whatever the store's base currency happened to be — 49 of 190 approved
-- brands (measured 2026-09-26) are EUR/GBP/AUD/NZD/JPY/DKK stores, so e.g.
-- a ¥203,500 duvet showed as $203,500.00 and a 1,200 kr shirt as $1,200.00.
--
-- From here on `price` is always USD — the store's own US-market price
-- when it has one (Shopify Markets, fetched with ?currency=USD), otherwise
-- converted from its base currency at the day's ECB rate. `prices` keeps
-- every real (non-converted) price we have per currency, e.g.
-- {"USD": 409, "GBP": 370}, so the upcoming country picker can show a UK
-- shopper the brand's actual GBP price rather than a USD→GBP round-trip.
alter table public.products add column if not exists prices jsonb not null default '{}';

-- The store's base currency (from Shopify's /meta.json, or the ld+json
-- offer's priceCurrency) and whether it serves real US-market pricing.
-- Informational — lets a currency problem be spotted from the Table Editor.
alter table public.brands add column if not exists currency text;
alter table public.brands add column if not exists has_usd_pricing boolean;

-- Headless Shopify stores (custom front end, e.g. aetherapparel.com) 404 on
-- /products.json at their main domain but serve it from a shop./store.
-- subdomain. Remembered here so every refresh doesn't have to re-probe.
alter table public.brands add column if not exists feed_domain text;

-- Non-Shopify (ld_json) stores are scraped one product page at a time, so a
-- large catalog can't be covered in one Edge Function run. The cursor is
-- where in the sitemap's product-URL list the next refresh picks up, so
-- daily refreshes walk the whole catalog over several days instead of
-- re-scraping the same first 60 pages forever.
alter table public.brands add column if not exists scrape_cursor int not null default 0;

-- Daily FX rates, USD-based (1 USD = rate units of currency). Written by
-- catalog-intake (from the ECB via frankfurter.dev), readable by the app so
-- the country picker can convert on the client.
create table if not exists public.fx_rates (
  currency   text primary key,
  rate       numeric(18, 6) not null,
  updated_at timestamptz not null default now()
);
alter table public.fx_rates enable row level security;
drop policy if exists "fx_rates_read" on public.fx_rates;
create policy "fx_rates_read" on public.fx_rates for select using (true);
