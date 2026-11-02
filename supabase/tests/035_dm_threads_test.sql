-- RLS and behavior tests for 035_dm_threads. Run with supabase/tests/run.sh.
-- Fixture users come from seed_before_035_dm_threads.sql. Each DO block is
-- its own transaction, so tests build on each other in order.
\set ON_ERROR_STOP 1

create schema tst;
grant usage on schema tst to anon, authenticated;

-- Act as a signed-in user (or anon when uid is null) until the block ends.
create function tst.as_user(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', coalesce(json_build_object('sub', uid)::text, ''), true);
  perform set_config('role', case when uid is null then 'anon' else 'authenticated' end, true);
end $$;
create function tst.as_admin() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
create function tst.ok(name text, cond boolean) returns void language plpgsql as $$
begin
  raise notice '% %', case when cond then 'PASS' else 'FAIL' end, name;
end $$;
-- PASS when the statement raises.
create function tst.fails(name text, stmt text) returns void language plpgsql as $$
begin
  execute stmt;
  raise notice 'FAIL % (no error)', name;
exception when others then
  raise notice 'PASS % (%)', name, sqlerrm;
end $$;
grant execute on all functions in schema tst to anon, authenticated;

-- Fixture ids.
create function tst.u(c text) returns uuid language sql immutable as $$
  select ('00000000-0000-0000-0000-00000000000' || c)::uuid
$$;
grant execute on function tst.u(text) to anon, authenticated;

-- ---------------------------------------------------------------- backfill
do $$
declare ab uuid; begin
  select id into ab from threads where direct_key = tst.u('a') || ':' || tst.u('b');
  perform tst.ok('backfill: one thread per pair (2)', (select count(*) from threads) = 2);
  perform tst.ok('backfill: A-B has 2 messages, blank row skipped', (select count(*) from messages where thread_id = ab) = 2);
  perform tst.ok('backfill: product snapshot kept',
    (select product_data->>'name' from messages where thread_id = ab and product_id = 'p1') = 'Chore Coat');
  perform tst.ok('backfill: original timestamps kept',
    (select last_message_at from threads where id = ab) = (select max(created_at) from shares where message = 'love it'));
  perform tst.ok('backfill: 4 participant rows', (select count(*) from thread_participants) = 4);
end $$;

do $$ begin
  perform tst.as_user(tst.u('a'));
  perform tst.ok('backfill: A has 1 unread (B''s reply)', (select unread_count from inbox_threads()) = 1);
  perform tst.as_user(tst.u('b'));
  perform tst.ok('backfill: B has 0 unread (read the share)', (select unread_count from inbox_threads()) = 0);
end $$;

-- ---------------------------------------------------------------- participant
do $$
declare ab uuid; cd uuid; m messages; begin
  select id into ab from threads where direct_key = tst.u('a') || ':' || tst.u('b');
  select id into cd from threads where direct_key = tst.u('c') || ':' || tst.u('d');
  perform tst.as_user(tst.u('a'));

  perform tst.ok('participant: sees own thread only', (select count(*) from threads) = 1 and exists (select 1 from threads where id = ab));
  perform tst.ok('participant: reads thread messages', (select count(*) from messages where thread_id = ab) = 2);
  perform tst.ok('participant: sees both participants', (select count(*) from thread_participants where thread_id = ab) = 2);

  insert into messages (thread_id, body, created_at) values (ab, 'hey', now() + interval '10 years') returning * into m;
  perform tst.ok('participant: can send as self', m.sender_id = tst.u('a'));
  perform tst.ok('participant: created_at is server time', m.created_at <= now());
  perform tst.ok('participant: send bumps last_message_at', (select last_message_at from threads where id = ab) = m.created_at);

  perform tst.fails('participant: cannot send as someone else',
    format('insert into messages (thread_id, sender_id, body) values (%L, %L, ''spoof'')', ab, tst.u('b')));
  perform tst.fails('participant: cannot send into a thread they''re not in',
    format('insert into messages (thread_id, body) values (%L, ''hi'')', cd));
  perform tst.fails('participant: empty message rejected',
    format('insert into messages (thread_id, body) values (%L, ''  '')', ab));
  perform tst.fails('participant: over-2000-char message rejected',
    format('insert into messages (thread_id, body) values (%L, repeat(''x'', 2001))', ab));
  perform tst.fails('participant: cannot create threads directly', 'insert into threads default values');
  perform tst.fails('participant: cannot add themselves to a thread',
    format('insert into thread_participants (thread_id, user_id) values (%L, %L)', cd, tst.u('a')));

  update messages set body = 'edited' where thread_id = ab;
  perform tst.ok('participant: cannot edit messages', not exists (select 1 from messages where body = 'edited'));
  delete from messages where thread_id = ab;
  perform tst.ok('participant: cannot delete messages', (select count(*) from messages where thread_id = ab) = 3);
  update thread_participants set user_id = tst.u('c') where thread_id = ab;
  perform tst.ok('participant: cannot rewrite participant rows', (select count(*) from thread_participants where thread_id = ab and user_id = tst.u('a')) = 1);
end $$;

-- ---------------------------------------------------------------- unread
do $$
declare ab uuid; begin
  select id into ab from threads where direct_key = tst.u('a') || ':' || tst.u('b');
  perform tst.as_user(tst.u('b'));
  perform tst.ok('unread: B now has 1 unread', (select unread_count from inbox_threads() where thread_id = ab) = 1);
  perform tst.ok('unread: dm_unread_total = 1', dm_unread_total() = 1);
  perform tst.ok('inbox: preview is latest message', (select last_message_body from inbox_threads() where thread_id = ab) = 'hey');
  perform tst.ok('inbox: other user is A', (select other_username from inbox_threads() where thread_id = ab) = 'ava');
  perform mark_thread_read(ab);
  perform tst.ok('unread: mark_thread_read clears it', dm_unread_total() = 0);
  perform tst.as_user(tst.u('a'));
  perform tst.ok('unread: own messages never count', (select unread_count from inbox_threads() where thread_id = ab) = 1);
  perform tst.ok('unread: B marking read leaves A''s state alone',
    (select last_read_at from thread_participants where thread_id = ab and user_id = tst.u('a')) is null);
end $$;

-- ---------------------------------------------------------------- non-participant
do $$
declare ab uuid; begin
  perform tst.as_admin();
  select id into ab from threads where direct_key = tst.u('a') || ':' || tst.u('b');
  perform tst.as_user(tst.u('c'));
  perform tst.ok('non-participant: cannot see the thread', not exists (select 1 from threads where id = ab));
  perform tst.ok('non-participant: cannot read its messages', (select count(*) from messages where thread_id = ab) = 0);
  perform tst.ok('non-participant: cannot see its participants', (select count(*) from thread_participants where thread_id = ab) = 0);
  perform tst.ok('non-participant: inbox only has own thread', (select count(*) from inbox_threads()) = 1);
  perform mark_thread_read(ab);
  perform tst.as_admin();
  perform tst.ok('non-participant: mark_thread_read is a no-op',
    (select count(*) from thread_participants where thread_id = ab and user_id = tst.u('c')) = 0);
end $$;

-- ---------------------------------------------------------------- anon
do $$
declare ab uuid; begin
  select id into ab from threads where direct_key = tst.u('a') || ':' || tst.u('b');
  perform tst.as_user(null);
  perform tst.ok('anon: reads no messages', (select count(*) from messages) = 0);
  perform tst.fails('anon: cannot send', format('insert into messages (thread_id, body) values (%L, ''x'')', ab));
  perform tst.fails('anon: cannot start a thread', format('select start_direct_thread(%L)', tst.u('a')));
  perform tst.fails('anon: cannot read the inbox', 'select * from inbox_threads()');
end $$;

-- ---------------------------------------------------------------- start_direct_thread
do $$
declare t1 uuid; t2 uuid; t3 uuid; begin
  perform tst.as_user(tst.u('a'));
  t1 := start_direct_thread(tst.u('e'));
  t2 := start_direct_thread(tst.u('e'));
  perform tst.as_user(tst.u('e'));
  t3 := start_direct_thread(tst.u('a'));
  perform tst.ok('start: same thread every time, from either side', t1 = t2 and t2 = t3);
  perform tst.ok('start: both are participants', (select count(*) from thread_participants where thread_id = t1) = 2);
  perform tst.ok('start: empty thread stays out of the inbox', not exists (select 1 from inbox_threads() where thread_id = t1));
  perform tst.fails('start: cannot message yourself', format('select start_direct_thread(%L)', tst.u('e')));
  perform tst.fails('start: unknown user', 'select start_direct_thread(gen_random_uuid())');
end $$;

-- ---------------------------------------------------------------- blocked user
-- D blocks A after they've talked.
do $$
declare ad uuid; begin
  perform tst.as_user(tst.u('a'));
  ad := start_direct_thread(tst.u('d'));
  insert into messages (thread_id, body) values (ad, 'hi dee');
  perform tst.as_user(tst.u('d'));
  insert into user_blocks (blocker_id, blocked_id) values (tst.u('d'), tst.u('a'));
  perform tst.ok('block: blocker sees their block', (select count(*) from user_blocks) = 1);
  perform tst.ok('block: inbox flags blocked_by_me', (select blocked_by_me from inbox_threads() where thread_id = ad));
  perform tst.fails('block: blocker can''t send to the blocked user either',
    format('insert into messages (thread_id, body) values (%L, ''x'')', ad));
  perform tst.fails('block: cannot block yourself',
    format('insert into user_blocks (blocker_id, blocked_id) values (%L, %L)', tst.u('d'), tst.u('d')));

  perform tst.as_user(tst.u('a'));
  perform tst.fails('blocked: cannot send into the thread',
    format('insert into messages (thread_id, body) values (%L, ''hello?'')', ad));
  perform tst.fails('blocked: cannot start a new thread', format('select start_direct_thread(%L)', tst.u('d')));
  perform tst.ok('blocked: cannot see the block row', (select count(*) from user_blocks) = 0);
  perform tst.ok('blocked: inbox doesn''t reveal the block', not (select blocked_by_me from inbox_threads() where thread_id = ad));
  perform tst.ok('blocked: still reads existing history', (select count(*) from messages where thread_id = ad) = 1);
  perform tst.fails('blocked: cannot probe blocks between others',
    format('select is_blocked_between(%L, %L)', tst.u('d'), tst.u('a')));
  perform tst.fails('blocked: cannot insert a block as someone else',
    format('insert into user_blocks (blocker_id, blocked_id) values (%L, %L)', tst.u('d'), tst.u('e')));
  delete from user_blocks;
  perform tst.as_admin();
  perform tst.ok('blocked: cannot remove the block', (select count(*) from user_blocks) = 1);
  perform tst.as_user(tst.u('b'));
  insert into messages (thread_id, body)
    select id, 'unaffected' from threads where direct_key = tst.u('a') || ':' || tst.u('b');
  perform tst.ok('block: other threads unaffected', true);

  perform tst.as_user(tst.u('d'));
  delete from user_blocks where blocked_id = tst.u('a');
  perform tst.as_user(tst.u('a'));
  insert into messages (thread_id, body) values (ad, 'back again');
  perform tst.ok('unblock: sending works again', (select count(*) from messages where thread_id = ad) = 2);
end $$;

-- ---------------------------------------------------------------- realtime
do $$ begin
  perform tst.ok('realtime: messages is published',
    exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'messages'));
end $$;

-- ---------------------------------------------------------------- inbox plan
-- Not an assertion on speed, just that the latest-message lookup uses the index.
do $$
declare plan text := ''; line text; begin
  set local enable_seqscan = off;
  for line in execute 'explain select id from messages where thread_id = ''00000000-0000-0000-0000-000000000000'' order by created_at desc limit 1' loop
    plan := plan || line;
  end loop;
  perform tst.ok('index: latest message per thread uses messages_thread_id_created_at_idx', plan like '%messages_thread_id_created_at_idx%');
end $$;

-- ---------------------------------------------------------------- account deletion
do $$
declare ab uuid; begin
  select id into ab from threads where direct_key = tst.u('a') || ':' || tst.u('b');
  insert into user_blocks values (tst.u('a'), tst.u('c'));
  delete from auth.users where id = tst.u('a');
  perform tst.ok('delete: user''s messages removed', (select count(*) from messages where sender_id = tst.u('a')) = 0);
  perform tst.ok('delete: user''s participant rows removed', (select count(*) from thread_participants where user_id = tst.u('a')) = 0);
  perform tst.ok('delete: user''s blocks removed', (select count(*) from user_blocks where tst.u('a') in (blocker_id, blocked_id)) = 0);
  perform tst.ok('delete: other side keeps the thread and their messages',
    exists (select 1 from threads where id = ab) and (select count(*) from messages where thread_id = ab) = 2);
  perform tst.as_user(tst.u('b'));
  perform tst.ok('delete: other side''s inbox shows a deleted user',
    (select other_user_id is null from inbox_threads() where thread_id = ab));
  perform tst.as_admin();
  delete from auth.users where id = tst.u('b');
  perform tst.ok('delete: thread gone once both have left', not exists (select 1 from threads where id = ab));
  perform tst.ok('delete: threads A had with D and E remain for them',
    (select count(*) from threads t join thread_participants p on p.thread_id = t.id where p.user_id in (tst.u('d'), tst.u('e'))) = 3);
end $$;
