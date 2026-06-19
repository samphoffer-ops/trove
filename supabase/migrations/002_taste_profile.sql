-- ----------------------------------------------------------------
-- Trove – Taste profile (onboarding) fields
-- Run in: Dashboard → SQL Editor → New query → Run
-- ----------------------------------------------------------------

alter table public.profiles
  add column if not exists taste_brands          text[] not null default '{}',
  add column if not exists taste_styles          text[] not null default '{}',
  add column if not exists taste_categories      text[] not null default '{}',
  add column if not exists onboarding_completed_at timestamptz;
