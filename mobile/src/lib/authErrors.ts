import type { AuthError } from '@supabase/supabase-js';

// Trove's own copy for email/password auth. Fields are checked on the device
// before any request, and Supabase's errors are mapped by code (falling back
// to a few message patterns for older servers) so its raw strings, like
// "missing email or phone", never reach the user.

export type AuthMessage = { title: string; message?: string };

// Supabase's default minimum; the server stays the source of truth.
export const MIN_PASSWORD_LENGTH = 6;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): AuthMessage | null {
  if (!email.trim()) return { title: 'Enter your email', message: 'Add the email address for your Trove account.' };
  if (!EMAIL_PATTERN.test(email.trim())) return { title: 'Check your email', message: 'That doesn’t look like a valid email address.' };
  return null;
}

export function validateSignIn(email: string, password: string): AuthMessage | null {
  return validateEmail(email) ?? (password ? null : { title: 'Enter your password' });
}

export function validateSignUp(username: string, email: string, password: string): AuthMessage | null {
  if (!username.trim()) return { title: 'Pick a username' };
  const emailError = validateEmail(email);
  if (emailError) return emailError;
  if (!password) return { title: 'Choose a password' };
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { title: 'Password too short', message: `Use at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  return null;
}

export const ALREADY_REGISTERED: AuthMessage = { title: 'You already have an account', message: 'Sign in with this email instead.' };

const GENERIC: AuthMessage = { title: 'Something went wrong', message: 'Please check your connection and try again.' };

export function authErrorMessage(error: AuthError | Error | null | undefined): AuthMessage {
  if (!error) return GENERIC;
  const code = (error as AuthError).code;
  const text = error.message?.toLowerCase() ?? '';

  if (code === 'invalid_credentials' || text.includes('invalid login credentials')) {
    return { title: 'Wrong email or password', message: 'Check your details and try again.' };
  }
  if (code === 'email_not_confirmed' || text.includes('email not confirmed')) {
    return { title: 'Confirm your email', message: 'Tap the link we emailed you, then sign in.' };
  }
  if (code === 'user_already_exists' || code === 'email_exists' || text.includes('already registered')) {
    return ALREADY_REGISTERED;
  }
  if (code === 'weak_password' || text.includes('password should')) {
    return { title: 'Choose a stronger password', message: 'Try a longer password with a mix of letters, numbers and symbols.' };
  }
  if (code === 'email_address_invalid' || code === 'validation_failed') {
    return { title: 'Check your email', message: 'That doesn’t look like a valid email address.' };
  }
  if (code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit' || (error as AuthError).status === 429) {
    return { title: 'Too many attempts', message: 'Wait a minute, then try again.' };
  }
  return GENERIC;
}
