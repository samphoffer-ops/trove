-- ----------------------------------------------------------------
-- Trove – profile bio, for the real profile-page rebuild
-- Run in: Dashboard → SQL Editor → New query → Run
-- ----------------------------------------------------------------

alter table public.profiles add column if not exists bio text;
