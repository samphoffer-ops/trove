import { Platform, Linking } from 'react-native';
import { router, Href } from 'expo-router';
import { useProductModalStore } from '@/store/useProductModalStore';

// On native, Linking.openURL hands off to the OS (Safari/Chrome as a
// separate app) — the RN app stays alive in the background untouched. On
// web, Linking.openURL navigates the CURRENT tab to the external site
// instead of opening a new one; coming back via the browser's back button
// then re-triggers a full static-export reload of the SPA, which lands on
// the root route rather than wherever you were (losing scroll position,
// list state, everything). window.open with _blank sidesteps that
// entirely by leaving the original tab alone.
export function openExternal(url: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
  } else {
    Linking.openURL(url);
  }
}

// router.back() relies on Expo Router's in-memory navigation stack, not
// browser history — it silently no-ops if there's no in-app "back" entry,
// which happens whenever a screen is the first thing loaded (a shared board
// link, a deep link, a fresh page load/refresh on web). Always provide a
// real fallback route instead of assuming there's something to go back to.
export function goBack(fallback: Href) {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}

// Desktop-web-width gets the glass modal (feed stays mounted + blurred
// behind it); everything else (native, or a narrow/mobile web viewport)
// keeps the plain full-screen route navigation, which is the only thing
// that makes sense on an actual phone-sized screen regardless of platform.
const DESKTOP_MODAL_MIN_WIDTH = 820;

export function openProduct(productId: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.innerWidth >= DESKTOP_MODAL_MIN_WIDTH) {
    useProductModalStore.getState().open(productId);
  } else {
    router.push(`/product/${productId}`);
  }
}
