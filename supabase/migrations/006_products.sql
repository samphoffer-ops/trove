-- ----------------------------------------------------------------
-- Trove – Catalog tables (brands + products), replacing the static
-- mobile/src/data/products.ts array as the source of truth.
-- Run in: Dashboard → SQL Editor → New query → Run
-- ----------------------------------------------------------------

create table public.brands (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null unique,
  domain             text not null unique,
  status             text not null default 'pending_review' check (status in ('pending_review', 'approved', 'rejected')),
  platform           text check (platform in ('shopify', 'ld_json')),
  judge_confidence   int,
  judge_reasoning    text,
  matched_categories text[],
  matched_styles     text[],
  approved_by        uuid references public.profiles(id),
  approved_at        timestamptz,
  rejected_until     timestamptz,
  created_at         timestamptz default now()
);

create table public.products (
  id              text primary key,
  brand_id        uuid not null references public.brands(id) on delete cascade,
  brand           text not null,
  name            text not null,
  price           numeric(10, 2) not null,
  image           text not null,
  ratio           numeric(5, 3) not null default 1.25,
  url             text not null,
  category        text check (category in ('clothing', 'shoes', 'bags', 'accessories', 'home', 'beauty')),
  styles          text[] not null default '{}',
  description     text,
  source          text not null default 'manual' check (source in ('manual', 'auto_scrape')),
  external_handle text,
  status          text not null default 'active' check (status in ('active', 'stale', 'removed')),
  first_seen_at   timestamptz not null default now(),
  last_seen_at    timestamptz not null default now(),
  price_history   jsonb not null default '[]',
  removed_at      timestamptz,
  created_at      timestamptz default now()
);

create index on public.products(category);
create index on public.products(status);
create index on public.products(brand_id);
create index on public.products using gin(styles);

alter table public.products enable row level security;
alter table public.brands enable row level security;

create policy "products_read" on public.products for select using (status = 'active');
create policy "brands_read" on public.brands for select using (status = 'approved');
-- No public insert/update policy on either table — all writes happen via the
-- catalog-intake Edge Function's service-role key, or Sam directly in the
-- Supabase dashboard Table Editor (same pattern as brand_inquiries review).
