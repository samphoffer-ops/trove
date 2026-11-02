import { useAuthStore } from '@/store/useAuthStore';

// Every outbound product tap goes through the `go` Edge Function (#27),
// which looks the product up server-side, applies affiliate wrapping, logs
// the click_out and 302s to the brand. The app never builds brand or
// affiliate URLs itself, and never logs click_out: the server is the one
// source of truth, so each tap is counted once.
//
// The browser opens this URL directly, so it can't carry the session; the
// user id rides along as `u` for attribution (signed-out taps still
// redirect, just unlogged).
export function getClickOutUrl(productId: string): string {
  const params = new URLSearchParams({ p: productId });
  const userId = useAuthStore.getState().user?.id;
  if (userId) params.set('u', userId);
  return `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/go?${params.toString()}`;
}
