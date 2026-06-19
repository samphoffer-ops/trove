import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';

export default function RootLayout() {
  const { setSession, fetchProfile } = useAuthStore();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);

      if (event === 'SIGNED_IN') {
        fetchProfile().then(profile => {
          router.replace(profile?.onboarding_completed_at ? '/(tabs)/feed' : '/onboarding');
        });
      } else if (event === 'SIGNED_OUT') {
        router.replace('/(auth)/sign-in');
      } else if (event === 'INITIAL_SESSION') {
        // loading=false is set by setSession above; index.tsx handles initial routing
        if (session) fetchProfile();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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
      </Stack>
    </GestureHandlerRootView>
  );
}
