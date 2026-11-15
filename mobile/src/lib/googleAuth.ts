import type * as WebBrowserModule from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';

// Native module that only exists in builds made after #136. As with Apple
// (lib/appleAuth.ts), a top-level import would take the sign-in screen down
// on an older dev build, so load it lazily and fail with a readable error.
let webBrowser: typeof WebBrowserModule | null | undefined;
function loadWebBrowser(): typeof WebBrowserModule | null {
  if (webBrowser === undefined) {
    try {
      webBrowser = require('expo-web-browser');
    } catch {
      webBrowser = null;
    }
  }
  return webBrowser ?? null;
}

// Google sign-in through Supabase's hosted OAuth flow.
//
// Supabase builds the Google consent URL; we open it in the system auth
// sheet (ASWebAuthenticationSession on iOS), which hands back the redirect
// to trove://auth/callback without the URL ever reaching the router. The
// client uses the implicit flow, so the session tokens arrive in the
// redirect's fragment. Routing afterwards (onboarding for new users, feed
// for returning ones) is the root layout's SIGNED_IN handler, same as email.
//
// Resolves false when the user closes the sheet — not an error, so callers
// shouldn't alert on it. Throws on real failures.
export async function signInWithGoogle(): Promise<boolean> {
  const WebBrowser = loadWebBrowser();
  if (!WebBrowser) throw new Error('Sign in with Google needs the latest app build.');

  const redirectTo = Linking.createURL('auth/callback');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options:  { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return false;

  const params = callbackParams(result.url);
  if (params.error) throw new Error(params.error_description ?? params.error);
  if (!params.access_token || !params.refresh_token) {
    throw new Error('Google didn’t return a session.');
  }

  const { error: sessionError } = await supabase.auth.setSession({
    access_token:  params.access_token,
    refresh_token: params.refresh_token,
  });
  if (sessionError) throw sessionError;

  await saveGoogleName();
  return true;
}

// Tokens come back in the fragment; OAuth errors can come in either the
// query or the fragment depending on where the flow failed.
function callbackParams(url: string): Record<string, string> {
  const params: Record<string, string> = {};
  const [beforeHash, hash = ''] = url.split('#');
  const query = beforeHash.split('?')[1] ?? '';
  for (const part of [query, hash]) {
    new URLSearchParams(part).forEach((value, key) => { params[key] = value; });
  }
  return params;
}

// The signup trigger set display_name from the email prefix. Google shares
// the user's real name, so use it — only for brand-new accounts, so an
// existing user who signs in with Google later keeps the name they chose.
async function saveGoogleName() {
  const { data: { user } } = await supabase.auth.getUser();
  const fullName = (user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? '').trim();
  if (!fullName) return;

  const { fetchProfile, updateProfile } = useAuthStore.getState();
  const profile = await fetchProfile();
  if (profile && !profile.onboarding_completed_at) {
    await updateProfile({ display_name: fullName });
  }
}
