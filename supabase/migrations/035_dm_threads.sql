-- ----------------------------------------------------------------
-- Trove – DM threads, participants, messages and blocks (#91)
-- Run in: Dashboard → SQL Editor → New query → Run
-- ----------------------------------------------------------------

-- DMs used to be `shares` rows (003, 016, 017): one row per message with
-- no thread entity, grouped into conversations on the client. This adds
-- real threads so the inbox can read one row per thread, unread is one
-- last_read_at per participant, and blocks (#96) and content filtering
-- (#97) have a single place to hook in.
--
-- `shares` is backfilled below and otherwise left untouched, so the
-- current inbox screens keep working until #92/#93 move the client over.
-- A later migration drops it.
--
-- Account deletion: every user reference here cascades from profiles
-- (which cascades from auth.users), so deleting a user removes their
-- participant rows, their messages and both sides of their blocks. A
-- thread is removed once its last participant is gone.

create table public.threads (
  id              uuid primary key default gen_random_uuid(),
  -- 1:1 threads only for now: the two user ids, sorted, joined by ':'.
  -- Unique, so two people always share one thread.
  direct_key      text unique,
  last_message_at timestamptz,
  created_at      timestamptz not null default now()
);

create table public.thread_participants (
  thread_id    uuid not null references public.threads(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  -- Unread = messages from others created after this.
  last_read_at timestamptz,
  created_at   timestamptz not null default now(),
  primary key (thread_id, user_id)
);

create table public.messages (
  id           uuid primary key default gen_random_uuid(),
  thread_id    uuid not null references public.threads(id) on delete cascade,
  sender_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body         text check (char_length(btrim(body)) between 1 and 2000),
  -- Optional product snapshot, same shape as shares.product_data.
  product_id   text,
  product_data jsonb,
  created_at   timestamptz not null default now(),
  check ((product_id is null) = (product_data is null)),
  check (body is not null or product_id is not null)
);

create table public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

-- Thread pagination, latest message per thread, and the unread range scan.
create index on public.messages(thread_id, created_at desc);
create index on public.messages(sender_id);
-- "My threads".
create index on public.thread_participants(user_id);
-- Inbox ordering.
create index on public.threads(last_message_at desc);
-- Block checks from the blocked side.
create index on public.user_blocks(blocked_id);

-- ----------------------------------------------------------------
-- Backfill from shares. Runs before the triggers below so the
-- original timestamps survive.
-- ----------------------------------------------------------------
insert into public.threads (direct_key, created_at)
select least(sender_id, recipient_id)::text || ':' || greatest(sender_id, recipient_id)::text,
       coalesce(min(created_at), now())
from public.shares
group by 1;

insert into public.thread_participants (thread_id, user_id, last_read_at)
select t.id, u.user_id,
       (select max(s.created_at) from public.shares s
         where s.recipient_id = u.user_id
           and least(s.sender_id, s.recipient_id)::text || ':' || greatest(s.sender_id, s.recipient_id)::text = t.direct_key
           and s.read_at is not null)
from public.threads t
cross join lateral (values (split_part(t.direct_key, ':', 1)::uuid),
                           (split_part(t.direct_key, ':', 2)::uuid)) as u(user_id);

insert into public.messages (thread_id, sender_id, body, product_id, product_data, created_at)
select t.id, s.sender_id,
       left(nullif(btrim(s.message), ''), 2000),
       case when s.product_data is not null then s.product_id end,
       case when s.product_id is not null then s.product_data end,
       coalesce(s.created_at, now())
from public.shares s
join public.threads t
  on t.direct_key = least(s.sender_id, s.recipient_id)::text || ':' || greatest(s.sender_id, s.recipient_id)::text
where nullif(btrim(s.message), '') is not null
   or (s.product_id is not null and s.product_data is not null);

-- From the messages that made it over, not every share (blank rows were
-- skipped). A thread left with none stays out of the inbox until used.
update public.threads t
   set last_message_at = (select max(m.created_at) from public.messages m where m.thread_id = t.id);

-- ----------------------------------------------------------------
-- Helpers. SECURITY DEFINER so policies on thread_participants can ask
-- "is the caller in this thread" without recursing into their own RLS
-- (the problem 004 fixed for board_collaborators).
-- ----------------------------------------------------------------
create or replace function public.is_thread_participant(check_thread_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.thread_participants
    where thread_id = check_thread_id and user_id = auth.uid()
  );
$$;

-- True when either user has blocked the other.
create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.user_blocks
    where (blocker_id = a and blocked_id = b)
       or (blocker_id = b and blocked_id = a)
  );
$$;

-- The caller is in the thread and no one else in it has a block with them.
create or replace function public.can_send_to_thread(check_thread_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_thread_participant(check_thread_id)
     and not exists (
       select 1 from public.thread_participants p
       where p.thread_id = check_thread_id
         and p.user_id <> auth.uid()
         and public.is_blocked_between(auth.uid(), p.user_id)
     );
$$;

-- ----------------------------------------------------------------
-- Triggers
-- ----------------------------------------------------------------

-- Server time only, so a client can't backdate or pin a message to the
-- top of the inbox.
create or replace function public.messages_set_created_at()
returns trigger
language plpgsql
as $$
begin
  new.created_at := now();
  return new;
end;
$$;

create trigger messages_set_created_at
  before insert on public.messages
  for each row execute function public.messages_set_created_at();

-- Keep threads.last_message_at current for the inbox ordering.
create or replace function public.messages_touch_thread()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.threads
     set last_message_at = greatest(coalesce(last_message_at, new.created_at), new.created_at)
   where id = new.thread_id;
  return new;
end;
$$;

create trigger messages_touch_thread
  after insert on public.messages
  for each row execute function public.messages_touch_thread();

-- Drop a thread once nobody is left in it (e.g. both accounts deleted).
create or replace function public.thread_participants_cleanup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.threads t
   where t.id = old.thread_id
     and not exists (select 1 from public.thread_participants p where p.thread_id = old.thread_id);
  return old;
end;
$$;

create trigger thread_participants_cleanup
  after delete on public.thread_participants
  for each row execute function public.thread_participants_cleanup();

-- ----------------------------------------------------------------
-- Row level security
-- ----------------------------------------------------------------
alter table public.threads             enable row level security;
alter table public.thread_participants enable row level security;
alter table public.messages            enable row level security;
alter table public.user_blocks         enable row level security;

-- Threads and participants are read-only for clients; they're created by
-- start_direct_thread() and read state moves through mark_thread_read().
create policy "threads_read" on public.threads for select using (
  public.is_thread_participant(id)
);
create policy "thread_participants_read" on public.thread_participants for select using (
  public.is_thread_participant(thread_id)
);

-- Messages: participants read; send only as yourself, only into threads
-- you're in, and never across a block. No update or delete.
create policy "messages_read" on public.messages for select using (
  public.is_thread_participant(thread_id)
);
create policy "messages_insert" on public.messages for insert with check (
  sender_id = auth.uid() and public.can_send_to_thread(thread_id)
);

-- Blocks are private to the blocker: a blocked user can't see the row.
create policy "user_blocks_read" on public.user_blocks for select using (
  blocker_id = auth.uid()
);
create policy "user_blocks_insert" on public.user_blocks for insert with check (
  blocker_id = auth.uid()
);
create policy "user_blocks_delete" on public.user_blocks for delete using (
  blocker_id = auth.uid()
);

-- ----------------------------------------------------------------
-- RPCs
-- ----------------------------------------------------------------

-- Get or create the 1:1 thread between the caller and another user (#95).
create or replace function public.start_direct_thread(other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me  uuid := auth.uid();
  key text;
  tid uuid;
begin
  if me is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if other_user_id is null or other_user_id = me then
    raise exception 'invalid recipient' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = other_user_id) then
    raise exception 'user not found' using errcode = 'P0002';
  end if;
  if public.is_blocked_between(me, other_user_id) then
    raise exception 'cannot message this user' using errcode = '42501';
  end if;

  key := least(me, other_user_id)::text || ':' || greatest(me, other_user_id)::text;

  insert into public.threads (direct_key) values (key)
  on conflict (direct_key) do nothing
  returning id into tid;
  if tid is null then
    select id into tid from public.threads where direct_key = key;
  end if;

  -- Re-adds a participant who'd been removed, too.
  insert into public.thread_participants (thread_id, user_id)
  values (tid, me), (tid, other_user_id)
  on conflict do nothing;

  return tid;
end;
$$;

-- Mark everything in a thread read for the caller (#93).
create or replace function public.mark_thread_read(p_thread_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.thread_participants
     set last_read_at = now()
   where thread_id = p_thread_id and user_id = auth.uid();
$$;

-- One row per thread for the caller's inbox, newest first (#92).
-- Pass the last row's last_message_at as p_before for the next page.
create or replace function public.inbox_threads(p_limit int default 50, p_before timestamptz default null)
returns table (
  thread_id              uuid,
  other_user_id          uuid,
  other_username         text,
  other_display_name     text,
  other_avatar_url       text,
  last_message_at        timestamptz,
  last_message_sender_id uuid,
  last_message_body      text,
  last_message_product   jsonb,
  unread_count           int,
  blocked_by_me          boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select t.id,
         o.user_id,
         pr.username,
         pr.display_name,
         pr.avatar_url,
         t.last_message_at,
         lm.sender_id,
         lm.body,
         -- Just enough for a preview line, not the whole snapshot.
         case when lm.product_data is not null then jsonb_build_object(
           'id', lm.product_id, 'name', lm.product_data->'name', 'brand', lm.product_data->'brand'
         ) end,
         (select count(*)::int from public.messages m
           where m.thread_id = t.id
             and m.sender_id <> me.user_id
             and m.created_at > coalesce(me.last_read_at, '-infinity')),
         exists (select 1 from public.user_blocks b
                  where b.blocker_id = me.user_id and b.blocked_id = o.user_id)
  from public.thread_participants me
  join public.threads t on t.id = me.thread_id
  left join lateral (
    select p.user_id from public.thread_participants p
    where p.thread_id = t.id and p.user_id <> me.user_id
    limit 1
  ) o on true
  left join public.profiles pr on pr.id = o.user_id
  left join lateral (
    select m.sender_id, m.body, m.product_id, m.product_data
    from public.messages m
    where m.thread_id = t.id
    order by m.created_at desc
    limit 1
  ) lm on true
  where me.user_id = auth.uid()
    and t.last_message_at is not null
    and (p_before is null or t.last_message_at < p_before)
  order by t.last_message_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

-- Total unread across the caller's threads, for the header badge (#94).
create or replace function public.dm_unread_total()
returns int
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::int
  from public.thread_participants me
  join public.messages m on m.thread_id = me.thread_id
  where me.user_id = auth.uid()
    and m.sender_id <> me.user_id
    and m.created_at > coalesce(me.last_read_at, '-infinity');
$$;

-- Internal only: callable from the definer functions above, but not by
-- clients, who could otherwise ask whether any two users have a block.
revoke execute on function public.is_blocked_between(uuid, uuid)     from public, anon, authenticated;

-- RPCs are for signed-in users only.
revoke execute on function public.start_direct_thread(uuid)          from public, anon;
revoke execute on function public.mark_thread_read(uuid)             from public, anon;
revoke execute on function public.inbox_threads(int, timestamptz)    from public, anon;
revoke execute on function public.dm_unread_total()                  from public, anon;
grant  execute on function public.start_direct_thread(uuid)          to authenticated;
grant  execute on function public.mark_thread_read(uuid)             to authenticated;
grant  execute on function public.inbox_threads(int, timestamptz)    to authenticated;
grant  execute on function public.dm_unread_total()                  to authenticated;

-- Live messages for the thread screen (#93). Realtime applies the
-- messages_read policy above, so subscribers only get their own threads.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;
