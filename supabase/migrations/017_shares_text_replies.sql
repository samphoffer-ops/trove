-- Allow text-only direct messages (no product attached)
alter table public.shares alter column product_id drop not null;
alter table public.shares alter column product_data drop not null;
