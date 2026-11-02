-- ----------------------------------------------------------------
-- Trove – let in-app account deletion succeed for every user (#29)
-- Run in: Dashboard → SQL Editor → New query → Run
-- ----------------------------------------------------------------

-- brands.approved_by referenced profiles(id) with no "on delete" rule,
-- so deleting any user who had approved a brand failed with an FK
-- violation and left the whole account in place. The brand should
-- outlive whoever approved it, so the reference is cleared instead.
alter table public.brands drop constraint if exists brands_approved_by_fkey;
alter table public.brands
  add constraint brands_approved_by_fkey
  foreign key (approved_by) references public.profiles(id) on delete set null;
