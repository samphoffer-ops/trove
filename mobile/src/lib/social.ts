import { supabase } from './supabase';
import { Profile } from '@/types';

export async function fetchFollowing(userId: string): Promise<Profile[]> {
  const { data } = await supabase
    .from('follows')
    .select('following:profiles!follows_following_id_fkey(*)')
    .eq('follower_id', userId);
  return ((data ?? []) as unknown as { following: Profile }[])
    .map(r => r.following)
    .filter(Boolean);
}
