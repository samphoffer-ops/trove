-- Fixtures for 033's backfill from shares. Users:
--   A, B: have a DM history in shares
--   C, D: have a share between them only
--   E:    no history
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ava@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@test.local'),
  ('00000000-0000-0000-0000-00000000000c', 'cy@test.local'),
  ('00000000-0000-0000-0000-00000000000d', 'dee@test.local'),
  ('00000000-0000-0000-0000-00000000000e', 'eli@test.local');

insert into public.shares (sender_id, recipient_id, product_id, product_data, message, read_at, created_at) values
  -- A → B product share with a note, read by B.
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b',
   'p1', '{"id":"p1","name":"Chore Coat","brand":"Buck Mason"}', 'look', now() - interval '59 minutes', now() - interval '60 minutes'),
  -- B → A text reply, unread by A.
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000a',
   null, null, 'love it', null, now() - interval '30 minutes'),
  -- A → B empty row (blank message, no product): skipped by the backfill.
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b',
   null, null, '   ', null, now() - interval '20 minutes'),
  -- C → D product only, unread.
  ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000000d',
   'p2', '{"id":"p2","name":"Oxford","brand":"Brand"}', null, null, now() - interval '10 minutes');
