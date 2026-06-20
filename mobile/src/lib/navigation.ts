import { router, Href } from 'expo-router';

// router.back() relies on Expo Router's in-memory navigation stack, not
// browser history — it silently no-ops if there's no in-app "back" entry,
// which happens whenever a screen is the first thing loaded (a shared board
// link, a deep link, a fresh page load/refresh on web). Always provide a
// real fallback route instead of assuming there's something to go back to.
export function goBack(fallback: Href) {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
