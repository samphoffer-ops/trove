import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack, router } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  useFonts,
  Mulish_400Regular,
  Mulish_500Medium,
  Mulish_600SemiBold,
  Mulish_700Bold,
  Mulish_800ExtraBold,
} from '@expo-google-fonts/mulish';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';

// Body font is Mulish (brand spec). Headers want "Freight Display Pro Bold" —
// not applied yet, waiting on Sam to provide the licensed font files; headers
// fall back to the system bold font in the meantime via fontWeight as before.
//
// RN's Text/TextInput can't take a global default font via defaultProps —
// React 19 dropped defaultProps support for function components, so that
// classic RN trick is now a silent no-op. For web (the marketing site, and
// where every screenshot in this repo is rendered from), inject real CSS
// instead. Native still needs a proper shared <Text> wrapper component to
// get this consistently — flagged as a follow-up, not done here.
function injectWebFont() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (document.getElementById('trove-font-override')) return;
  const style = document.createElement('style');
  style.id = 'trove-font-override';
  style.textContent = `
    html, body, #root, [data-testid], input, textarea {
      font-family: 'Mulish_400Regular', -apple-system, sans-serif !important;
    }
  `;
  document.head.appendChild(style);
}

export default function RootLayout() {
  const { setSession, fetchProfile } = useAuthStore();
  const [fontsLoaded] = useFonts({
    Mulish_400Regular,
    Mulish_500Medium,
    Mulish_600SemiBold,
    Mulish_700Bold,
    Mulish_800ExtraBold,
  });

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);

      if (event === 'SIGNED_IN') {
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

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="product/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen name="board/[id]"   options={{ presentation: 'card' }} />
        <Stack.Screen name="user/[id]"    options={{ presentation: 'card' }} />
        <Stack.Screen name="inbox"        options={{ presentation: 'card' }} />
        <Stack.Screen name="privacy-policy" options={{ presentation: 'card' }} />
        <Stack.Screen name="terms"          options={{ presentation: 'card' }} />
        <Stack.Screen name="features"   options={{ presentation: 'card' }} />
        <Stack.Screen name="about"      options={{ presentation: 'card' }} />
        <Stack.Screen name="for-brands" options={{ presentation: 'card' }} />
        <Stack.Screen name="contact"    options={{ presentation: 'card' }} />
      </Stack>
    </GestureHandlerRootView>
  );
}
