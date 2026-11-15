-- ----------------------------------------------------------------
-- Trove – verify an account deletion left nothing behind (#29)
--
-- Run after deleting a TEST account, with its user id:
--   psql "$DB_URL" -v uid="'<user-uuid>'" -f supabase/tests/verify_account_deleted.sql
-- (or paste into the SQL Editor with :uid replaced by the quoted id)
--
-- Every column with a foreign key to auth.users(id) or public.profiles(id)
-- is found from pg_constraint, so tables added later (DMs, #91) are
-- checked without editing this file. Every row must show 0.
-- Rows without a user column (board_items) cascade from their board.
-- Board covers live at board-covers/{board_id}/; check those by the
-- board ids you noted before deleting.
-- ----------------------------------------------------------------

with fk_cols as (
  select n.nspname as schema_name, c.relname as table_name, a.attname as column_name
  from pg_constraint k
  join pg_class c      on c.oid = k.conrelid
  join pg_namespace n  on n.oid = c.relnamespace
  join pg_attribute a  on a.attrelid = k.conrelid and a.attnum = any (k.conkey)
  where k.contype = 'f'
    and k.confrelid in ('auth.users'::regclass, 'public.profiles'::regclass)
    and n.nspname = 'public'
)
select format('%I.%I.%I', schema_name, table_name, column_name) as checked,
       (xpath('/row/n/text()',
              query_to_xml(format('select count(*) as n from %I.%I where %I = %L::uuid',
                                  schema_name, table_name, column_name, :uid), false, true, '')))[1]::text::int as remaining
from fk_cols
union all
select 'auth.users.id', count(*)::int from auth.users where id = :uid::uuid
union all
select 'storage avatars/' || :uid || '/', count(*)::int
  from storage.objects where bucket_id = 'avatars' and name like :uid || '/%'
order by remaining desc, checked;
