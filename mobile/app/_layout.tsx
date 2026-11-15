import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, YoungSerif_400Regular } from '@expo-google-fonts/young-serif';
import { Colors } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { ProductModal } from '@/components/ProductModal';
import { LaunchScreen } from '@/components/LaunchScreen';
import { useAuthStore } from '@/store/useAuthStore';
import { useCurrencyStore } from '@/store/useCurrencyStore';
import { useProductsStore } from '@/store/useProductsStore';

// Keep the native splash up until fonts and the initial session are ready, so
// nothing paints in fallback fonts. LaunchScreen takes over from it.
SplashScreen.preventAutoHideAsync();

// Young Serif is for large text only; everything else is the system font
// (see Typography in src/lib/theme.ts).
//
// RN's Text/TextInput can't take a global default font via defaultProps —
// React 19 dropped defaultProps support for function components, so that
// classic RN trick is now a silent no-op. On native, leaving fontFamily unset
// already gives SF Pro. Web (the marketing site, and where every screenshot in
// this repo is rendered from) gets the matching system stack via real CSS.
function injectWebFont() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (document.getElementById('trove-font-override')) return;
  const style = document.createElement('style');
  style.id = 'trove-font-override';
  style.textContent = `
    html, body, #root, [data-testid], input, textarea {
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif;
    }
  `;
  document.head.appendChild(style);
}

export default function RootLayout() {
  const { setSession, fetchProfile } = useAuthStore();
  const [fontsLoaded] = useFonts({ YoungSerif_400Regular });
  const authReady = useAuthStore(s => !s.loading && !(s.session && s.profileLoading));
  // A signed-in, onboarded user lands on the feed: hold launch for its first
  // page too, so the handoff reveals products rather than a spinner.
  const landsOnFeed = useAuthStore(s => !!s.session && !!s.profile?.onboarding_completed_at);
  const feedReady = useProductsStore(s => s.loaded);
  const dataReady = authReady && (!landsOnFeed || feedReady);
  const [launching, setLaunching] = useState(Platform.OS !== 'web');
  // Never hold launch on a slow network: after this, go with what we have.
  const [launchTimedOut, setLaunchTimedOut] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setLaunchTimedOut(true), 4000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const previousUserId = useAuthStore.getState().user?.id;
      setSession(session);

      if (event === 'SIGNED_IN') {
        // Supabase re-emits SIGNED_IN whenever the browser tab regains
        // focus/visibility, even for an already-active session (part of its
        // auto-refresh behavior) — not just on a genuine new sign-in.
        // Force-navigating on every emission meant switching back to the
        // tab reset whatever screen you were on to the feed. Only redirect
        // on an actual sign-in transition (no user -> this user).
        if (session?.user?.id === previousUserId) return;
        fetchProfile().then(profile => {
          router.replace(profile?.onboarding_completed_at ? '/(tabs)/feed' : '/onboarding');
        });
      } else if (event === 'SIGNED_OUT') {
        // '/' resolves correctly per-platform: marketing home on web, sign-in on native.
        router.replace('/');
      } else if (event === 'INITIAL_SESSION') {
        // loading=false is set by setSession above; index.tsx handles initial routing
        if (session) fetchProfile();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (fontsLoaded) injectWebFont();
  }, [fontsLoaded]);

  // Exchange rates + this device's saved country, for the country picker.
  useEffect(() => { useCurrencyStore.getState().init(); }, []);

  // Native blocks first paint on custom fonts to avoid a system-font flash.
  // Web can't do that here: this same gate also runs during static export's
  // server-side render, where the async font fetch never resolves — blocking
  // on it there means every route (including the marketing pages this static
  // export exists for) prerenders as an empty shell. Web instead shows
  // fallback fonts immediately and swaps in via the CSS injected above.
  if (!fontsLoaded && Platform.OS !== 'web') return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* App-wide default: most screens sit on the light Colors.bg surface. */}
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
        {/* Transparent so the feed stays visible while the hero grows out of its
            card; the screen animates itself (lib/sharedTransition.ts). */}
        <Stack.Screen name="product/[id]" options={{ presentation: 'transparentModal', animation: 'none' }} />
        <Stack.Screen name="board/[id]"   options={{ presentation: 'card' }} />
        <Stack.Screen name="board/new"    options={{ presentation: 'formSheet', sheetAllowedDetents: 'fitToContents', sheetGrabberVisible: true, contentStyle: { backgroundColor: Colors.bg } }} />
        <Stack.Screen name="save"         options={{ presentation: 'formSheet', sheetAllowedDetents: [0.5, 1.0], sheetInitialDetentIndex: 0, sheetGrabberVisible: true, contentStyle: { backgroundColor: Colors.bg } }} />
        <Stack.Screen name="user/[id]"    options={{ presentation: 'card' }} />
        <Stack.Screen name="brand/[id]"   options={{ presentation: 'card' }} />
        <Stack.Screen name="inbox"        options={{ presentation: 'card' }} />
        <Stack.Screen name="profile"      options={{ presentation: 'card' }} />
        <Stack.Screen name="edit-profile" options={{ presentation: 'card' }} />
        <Stack.Screen name="settings"     options={{ presentation: 'card' }} />
        <Stack.Screen name="country"      options={{ presentation: 'card' }} />
        <Stack.Screen name="brand-review" options={{ presentation: 'card' }} />
        <Stack.Screen name="privacy-policy" options={{ presentation: 'card' }} />
        <Stack.Screen name="terms"          options={{ presentation: 'card' }} />
        <Stack.Screen name="features"   options={{ presentation: 'card' }} />
        <Stack.Screen name="about"      options={{ presentation: 'card' }} />
        <Stack.Screen name="for-brands" options={{ presentation: 'card' }} />
        <Stack.Screen name="contact"    options={{ presentation: 'card' }} />
      </Stack>
      <ProductModal />
      {launching && <LaunchScreen ready={fontsLoaded && (dataReady || launchTimedOut)} onDone={() => setLaunching(false)} />}
    </GestureHandlerRootView>
  );
}
