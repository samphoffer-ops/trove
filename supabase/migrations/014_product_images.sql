-- Multiple product photos
-- The scraper currently captures one hero image (products.image).
-- This column holds additional images (front, back, detail, lifestyle)
-- when the scraper finds them. The UI falls back to the single hero
-- gracefully so there's no migration impact on existing rows.
alter table public.products
  add column if not exists images text[] not null default '{}';
