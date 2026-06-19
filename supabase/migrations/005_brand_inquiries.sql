-- ----------------------------------------------------------------
-- Trove – Brand partnership inquiries (from the "For Brands" marketing page)
-- Run in: Dashboard → SQL Editor → New query → Run
-- ----------------------------------------------------------------

create table public.brand_inquiries (
  id            uuid primary key default gen_random_uuid(),
  brand_name    text not null,
  website       text not null,
  category      text,
  contact_email text not null,
  description   text,
  created_at    timestamptz default now()
);

alter table public.brand_inquiries enable row level security;

-- Anyone can submit an inquiry; nobody can read them back through the public
-- API — Sam reviews submissions in the Supabase dashboard Table Editor.
create policy "brand_inquiries_insert" on public.brand_inquiries for insert with check (true);
