import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Deletes the calling user's own auth.users row. Every other table
// (profiles, boards, board_items, board_collaborators, follows, shares)
// cascades from there via the "on delete cascade" foreign keys already
// defined in supabase/schema.sql + migrations — see those files before
// changing this function's behavior.
Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing authorization header' }), { status: 401 });
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const jwt = authHeader.replace('Bearer ', '');
  const { data: { user }, error: userError } = await admin.auth.getUser(jwt);
  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Invalid or expired session' }), { status: 401 });
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    return new Response(JSON.stringify({ error: deleteError.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
