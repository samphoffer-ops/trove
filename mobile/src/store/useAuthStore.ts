import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { Profile } from '@/types';

interface AuthState {
  session:    Session | null;
  user:       User | null;
  profile:    Profile | null;
  loading:    boolean;
  setSession: (s: Session | null) => void;
  fetchProfile: () => Promise<void>;
  signOut:    () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user:    null,
  profile: null,
  loading: true,

  setSession(session) {
    set({ session, user: session?.user ?? null, loading: false });
  },

  async fetchProfile() {
    const { user } = get();
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    if (data) set({ profile: data as Profile });
  },

  async signOut() {
    await supabase.auth.signOut();
    set({ session: null, user: null, profile: null });
  },
}));
