import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { Profile } from '@/types';

interface AuthState {
  session:        Session | null;
  user:           User | null;
  profile:        Profile | null;
  loading:        boolean;
  profileLoading: boolean;
  setSession:     (s: Session | null) => void;
  fetchProfile:   () => Promise<Profile | null>;
  completeOnboarding: (selections: { brands: string[]; styles: string[]; categories: string[] }) => Promise<void>;
  signOut:        () => Promise<void>;
  deleteAccount:  () => Promise<{ error?: string }>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session:        null,
  user:           null,
  profile:        null,
  loading:        true,
  profileLoading: true,

  setSession(session) {
    set({
      session,
      user:    session?.user ?? null,
      loading: false,
      // No session means there's no profile to wait on — unblock index.tsx's redirect check.
      profileLoading: !!session,
    });
  },

  async fetchProfile() {
    const { user } = get();
    if (!user) { set({ profileLoading: false }); return null; }
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    const profile = (data as Profile) ?? null;
    set({ profile, profileLoading: false });
    return profile;
  },

  async completeOnboarding({ brands, styles, categories }) {
    const { user } = get();
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .update({
        taste_brands:            brands,
        taste_styles:            styles,
        taste_categories:        categories,
        onboarding_completed_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select()
      .single();
    if (data) set({ profile: data as Profile });
  },

  async signOut() {
    await supabase.auth.signOut();
    set({ session: null, user: null, profile: null, profileLoading: false });
  },

  async deleteAccount() {
    // Deployed in Supabase under the name "smooth-api" (an auto-generated
    // name from the dashboard that a rename attempt didn't actually change) —
    // the code at supabase/functions/delete-account/index.ts is what's running.
    const { error } = await supabase.functions.invoke('smooth-api');
    if (error) return { error: 'Something went wrong deleting your account. Please try again.' };
    await get().signOut();
    return {};
  },
}));
