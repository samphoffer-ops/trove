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

export async function searchProfiles(query: string, excludeUserId?: string): Promise<Profile[]> {
  if (!query.trim()) return [];
  let req = supabase
    .from('profiles')
    .select('*')
    .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
    .limit(8);
  if (excludeUserId) req = req.neq('id', excludeUserId);
  const { data } = await req;
  return (data ?? []) as Profile[];
}
