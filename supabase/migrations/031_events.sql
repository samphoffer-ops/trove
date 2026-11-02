-- Event log for the core loop: saves, product opens, click-outs and
-- "not for me" dismissals. Click-outs are where affiliate revenue comes
-- from, and save / not_for_me feed ranking (#54), so this is append-only
-- history written straight from the client.
--
-- product_id and board_id deliberately have no FKs: catalog refresh and
-- dead-link checks remove products, and users delete boards, but the
-- history of what happened should survive both. user_id does cascade, so
-- in-app account deletion removes a user's events with them.
create table public.events (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type        text not null check (type in ('save', 'product_open', 'click_out', 'not_for_me')),
  product_id  text,
  board_id    uuid,
  properties  jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index on public.events(user_id, created_at desc);
create index on public.events(type, created_at desc);

-- Insert-only for clients, and only as themselves. No select/update/delete
-- policies: analytics reads go through the service role.
alter table public.events enable row level security;
create policy "events_insert_own" on public.events for insert with check (auth.uid() = user_id);
