-- Sign in with Apple (#24): make the signup trigger collision-safe.
--
-- handle_new_user() derives profiles.username (unique, not null) from the
-- email prefix. That collides as soon as two accounts share a prefix — e.g.
-- an Apple ID sam@icloud.com after sam@gmail.com already signed up — and a
-- failing trigger aborts the auth.users insert, so the user sees "Database
-- error saving new user" and can't create an account at all. Apple can also
-- omit the email entirely, which made the username null.
--
-- Now: same base name as before, falling back to 'user' with no email, plus
-- a short random suffix only when the base is already taken.

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  base      text := coalesce(
                      nullif(new.raw_user_meta_data->>'username', ''),
                      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
                      'user');
  candidate text := base;
begin
  while exists (select 1 from public.profiles where username = candidate) loop
    candidate := base || '_' || substr(md5(gen_random_uuid()::text), 1, 4);
  end loop;

  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    candidate,
    coalesce(new.raw_user_meta_data->>'display_name', base)
  );
  return new;
end;
$$;
