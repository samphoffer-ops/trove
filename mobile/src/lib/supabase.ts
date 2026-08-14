import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ExpoSecureStoreAdapter = {
  getItem:    (key: string) => SecureStore.getItemAsync(key),
  setItem:    (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

// Static export pre-renders routes in Node (no `window`), where AsyncStorage's
// web implementation crashes on access. Use a no-op adapter there; real
// browser/native sessions never hit this branch.
const noopStorage = {
  getItem:    async () => null,
  setItem:    async () => {},
  removeItem: async () => {},
};

// expo-secure-store has no web implementation; fall back to AsyncStorage (localStorage) there.
const authStorage = Platform.OS === 'web'
  ? (typeof window !== 'undefined' ? AsyncStorage : noopStorage)
  : ExpoSecureStoreAdapter;

// Static export's Node-based SSR pass constructs this client too (module
// scope, every route), and supabase-js eagerly builds a Realtime client on
// construction even though this app never uses realtime anywhere (no
// `.channel()`/`.subscribe()` calls in the codebase). Node 20 — the export
// pipeline's runtime — has no built-in WebSocket, so that eager construction
// throws and fails the whole build. A stub constructor satisfies the check
// without ever being invoked; real browser/native sessions get the real
// WebSocket and never take this branch.
class NoopWebSocket {}
const isNodeSSR = Platform.OS === 'web' && typeof window === 'undefined';

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage:            authStorage,
      autoRefreshToken:   true,
      persistSession:     true,
      detectSessionInUrl: false,
    },
    ...(isNodeSSR ? { realtime: { transport: NoopWebSocket as any } } : {}),
  },
);
