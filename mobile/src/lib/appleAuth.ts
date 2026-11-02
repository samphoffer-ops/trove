import type * as AppleAuthenticationModule from 'expo-apple-authentication';
import type * as CryptoModule from 'expo-crypto';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';

type AppleAuthNative = { AppleAuthentication: typeof AppleAuthenticationModule; Crypto: typeof CryptoModule };

// Both packages are native modules that only exist in builds made after #24.
// A top-level import throws ("Cannot find native module") on older dev
// builds, which would take the whole sign-in screen down with it. Load them
// lazily instead: where they're missing, Apple sign-in just isn't offered.
let native: AppleAuthNative | null | undefined;
export function loadAppleAuth(): AppleAuthNative | null {
  if (native === undefined) {
    try {
      native = { AppleAuthentication: require('expo-apple-authentication'), Crypto: require('expo-crypto') };
    } catch {
      native = null;
    }
  }
  return native;
}

export async function isAppleSignInAvailable(): Promise<boolean> {
  try {
    return (await loadAppleAuth()?.AppleAuthentication.isAvailableAsync()) ?? false;
  } catch {
    return false;
  }
}

// Native Sign in with Apple, exchanged for a Supabase session.
//
// Apple gets the SHA-256 of a one-time nonce and bakes it into the identity
// token; Supabase gets the raw nonce and checks the two match, so a token
// can't be replayed. Routing afterwards (onboarding for new users, feed for
// returning ones) is the root layout's SIGNED_IN handler, same as email.
//
// Resolves false when the user dismisses the Apple sheet — not an error,
// so callers shouldn't alert on it. Throws on real failures.
export async function signInWithApple(): Promise<boolean> {
  const loaded = loadAppleAuth();
  if (!loaded) throw new Error('Sign in with Apple needs the latest app build.');
  const { AppleAuthentication, Crypto } = loaded;

  const rawNonce    = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);

  let credential: AppleAuthenticationModule.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (e: any) {
    if (e?.code === 'ERR_REQUEST_CANCELED') return false;
    throw e;
  }

  if (!credential.identityToken) throw new Error('Apple didn’t return an identity token.');

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token:    credential.identityToken,
    nonce:    rawNonce,
  });
  if (error) throw error;

  // Apple shares the user's name only on the very first authorization, and
  // it isn't in the identity token — save it now or it's gone for good.
  const fullName = credential.fullName
    ? AppleAuthentication.formatFullName(credential.fullName).trim()
    : '';
  if (fullName) await saveFirstSignInName(fullName, credential.fullName!);

  return true;
}

async function saveFirstSignInName(fullName: string, parts: AppleAuthenticationModule.AppleAuthenticationFullName) {
  await supabase.auth.updateUser({
    data: { full_name: fullName, given_name: parts.givenName, family_name: parts.familyName },
  });

  // The signup trigger set display_name from the email prefix (often an
  // opaque privaterelay address). Replace it only for brand-new accounts, so
  // an existing user who links Apple later keeps the name they chose.
  const { fetchProfile, updateProfile } = useAuthStore.getState();
  const profile = await fetchProfile();
  if (profile && !profile.onboarding_completed_at) {
    await updateProfile({ display_name: fullName });
  }
}
