import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { countryByCode, deviceCountry, formatPrice } from '@/lib/currency';
import { useAuthStore } from '@/store/useAuthStore';

// The shopper's country drives which currency every price renders in.
// Signed-in: stored on profiles.country so it follows them across devices.
// Signed-out (the marketing site): remembered on this device only.
// Neither set: the device's region, then US.
const STORAGE_KEY = 'trove-country';

interface CurrencyState {
  localCountry: string | null;         // this device's pick, for signed-out use
  rates: Record<string, number>;       // units of X per 1 USD, from fx_rates
  ratesLoaded: boolean;
  init: () => Promise<void>;
  setCountry: (code: string) => Promise<{ error?: string }>;
}

// Static web export pre-renders in Node, where AsyncStorage has no window.
const canStore = typeof window !== 'undefined';

export const useCurrencyStore = create<CurrencyState>((set, get) => ({
  localCountry: null,
  rates: { USD: 1 },
  ratesLoaded: false,

  async init() {
    if (get().ratesLoaded) return;
    try {
      const [stored, { data }] = await Promise.all([
        canStore ? AsyncStorage.getItem(STORAGE_KEY).catch(() => null) : Promise.resolve(null),
        supabase.from('fx_rates').select('currency, rate'),
      ]);
      const rates: Record<string, number> = { USD: 1 };
      for (const r of data ?? []) rates[r.currency] = Number(r.rate);
      set({ localCountry: stored, rates, ratesLoaded: true });
    } catch {
      // Prices fall back to USD until rates load — never a wrong currency.
    }
  },

  async setCountry(code) {
    set({ localCountry: code });
    if (canStore) AsyncStorage.setItem(STORAGE_KEY, code).catch(() => {});
    if (useAuthStore.getState().user) return useAuthStore.getState().updateProfile({ country: code });
    return {};
  },
}));

// The effective country: profile, then this device's pick, then its region.
export function useCountry() {
  const profileCountry = useAuthStore(s => s.profile?.country);
  const localCountry = useCurrencyStore(s => s.localCountry);
  return countryByCode(profileCountry ?? localCountry ?? deviceCountry());
}

// `const price = usePriceFormatter(); price(product)` — every price in the
// app goes through this so the country setting applies everywhere.
export function usePriceFormatter() {
  const { currency } = useCountry();
  const rates = useCurrencyStore(s => s.rates);
  return (item: { price: number; prices?: Record<string, number> | null }) => formatPrice(item, currency, rates);
}
