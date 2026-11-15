import type { User } from '@supabase/supabase-js';

// Apple requires apps to revoke a user's Sign in with Apple token when they
// delete their account. supabase/functions/delete-account does the revoke,
// but it needs a fresh authorization code from re-authenticating, which only
// the device can get.

export function usesSignInWithApple(user: User | null): boolean {
  return (user?.identities ?? []).some(i => i.provider === 'apple');
}

/**
 * Prompts Sign in with Apple again and returns its authorizationCode, or
 * null if the user cancels.
 *
 * TODO(#24): Sign in with Apple owns the expo-apple-authentication
 * dependency. When it lands, implement this with
 * AppleAuthentication.signInAsync() and return credential.authorizationCode.
 * Until then no account has an Apple identity, so this is never reached.
 * Without a code, the server refuses (apple_reauth_required) and deletes
 * nothing.
 */
export async function reauthenticateWithApple(): Promise<string | null> {
  return null;
}
