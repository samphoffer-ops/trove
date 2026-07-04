-- Add optional message field to shares so senders can include a note
alter table public.shares add column if not exists message text;
