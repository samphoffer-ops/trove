import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// In-app account deletion (App Review Guideline 5.1.1(v)). Order matters:
//
//   1. Revoke Sign in with Apple, if the user has an Apple identity. Apple
//      requires this on deletion. It runs first so a failed revoke leaves
//      the account intact and the user can retry.
//   2. Remove the user's Storage uploads (avatars, covers of boards they
//      own). Foreign-key cascades never reach Storage.
//   3. Delete the auth.users row. Every user table cascades from it:
//      profiles (incl. taste profile columns), boards, board_items,
//      board_collaborators, follows, brand_follows, product_views,
//      not_interested, shares (sent and received), events, and the DM
//      tables. A new user table must reference profiles(id) or
//      auth.users(id) with "on delete cascade" (or "set null" for
//      non-owned references), or this step fails.
//      supabase/tests/verify_account_deleted.sql checks this.
Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Missing authorization header' }, 401);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const jwt = authHeader.replace('Bearer ', '');
  const { data: { user }, error: userError } = await admin.auth.getUser(jwt);
  if (userError || !user) return json({ error: 'Invalid or expired session' }, 401);

  const body = await req.json().catch(() => ({}));

  const hasApple = (user.identities ?? []).some((i) => i.provider === 'apple');
  if (hasApple) {
    const code = typeof body?.apple_authorization_code === 'string' ? body.apple_authorization_code : null;
    if (!code) return json({ error: 'apple_reauth_required' }, 400);
    try {
      await revokeApple(code);
    } catch (e) {
      console.error('apple revoke failed', e);
      return json({ error: 'apple_revoke_failed' }, 502);
    }
  }

  try {
    await removeUploads(admin, user.id);
  } catch (e) {
    console.error('storage cleanup failed', e);
    return json({ error: 'storage_cleanup_failed' }, 500);
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error('deleteUser failed', deleteError);
    return json({ error: deleteError.message }, 500);
  }

  return json({ success: true }, 200);
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// Path schemes come from mobile/src/lib/uploadImage.ts callers:
// avatars/{user_id}/avatar.<ext>, board-covers/{board_id}/cover.<ext>.
async function removeUploads(admin: SupabaseClient, userId: string) {
  const { data: boards, error } = await admin.from('boards').select('id').eq('user_id', userId);
  if (error) throw error;

  await removeFolder(admin, 'avatars', userId);
  for (const b of boards ?? []) await removeFolder(admin, 'board-covers', b.id);
}

async function removeFolder(admin: SupabaseClient, bucket: string, folder: string) {
  // Pages until the folder is empty; remove() deletes what list() returned.
  for (;;) {
    const { data, error } = await admin.storage.from(bucket).list(folder, { limit: 100 });
    if (error) throw error;
    if (!data || data.length === 0) return;
    const { error: rmError } = await admin.storage.from(bucket).remove(data.map((f) => `${folder}/${f.name}`));
    if (rmError) throw rmError;
  }
}

// Sign in with Apple token revocation. The client re-authenticates on the
// delete screen and sends a fresh authorization code; we trade it for a
// refresh token and revoke that, which ends the app's access for the
// user's Apple ID. No Apple tokens are stored anywhere.
// https://developer.apple.com/documentation/sign_in_with_apple/revoke_tokens
async function revokeApple(authorizationCode: string) {
  const clientId = Deno.env.get('APPLE_CLIENT_ID');
  const teamId = Deno.env.get('APPLE_TEAM_ID');
  const keyId = Deno.env.get('APPLE_KEY_ID');
  const privateKey = Deno.env.get('APPLE_PRIVATE_KEY');
  if (!clientId || !teamId || !keyId || !privateKey) throw new Error('Apple secrets not configured');

  const clientSecret = await appleClientSecret(clientId, teamId, keyId, privateKey);

  const tokenRes = await fetch('https://appleid.apple.com/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: authorizationCode,
      grant_type: 'authorization_code',
    }),
  });
  const tokens = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokens.refresh_token) throw new Error(`token exchange ${tokenRes.status}: ${tokens.error ?? ''}`);

  const revokeRes = await fetch('https://appleid.apple.com/auth/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      token: tokens.refresh_token,
      token_type_hint: 'refresh_token',
    }),
  });
  if (!revokeRes.ok) throw new Error(`revoke ${revokeRes.status}`);
}

// ES256 JWT signed with the Sign in with Apple .p8 key. Web Crypto's ECDSA
// output is already the raw r||s form JWS expects.
async function appleClientSecret(clientId: string, teamId: string, keyId: string, p8: string) {
  const pem = p8.replace(/\\n/g, '\n').replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);

  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'ES256', kid: keyId }));
  const payload = b64url(JSON.stringify({ iss: teamId, iat: now, exp: now + 300, aud: 'https://appleid.apple.com', sub: clientId }));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(`${header}.${payload}`));
  return `${header}.${payload}.${b64url(new Uint8Array(sig))}`;
}

function b64url(input: string | Uint8Array) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
