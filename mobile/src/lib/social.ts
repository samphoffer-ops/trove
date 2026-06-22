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

export async function isBrandFollowed(userId: string, brandId: string): Promise<boolean> {
  const { data } = await supabase
    .from('brand_follows').select('id')
    .eq('user_id', userId).eq('brand_id', brandId).maybeSingle();
  return !!data;
}

export async function fetchBrandFollowerCount(brandId: string): Promise<number> {
  const { count } = await supabase
    .from('brand_follows').select('id', { count: 'exact' }).eq('brand_id', brandId);
  return count ?? 0;
}

export async function followBrand(userId: string, brandId: string): Promise<void> {
  await supabase.from('brand_follows').insert({ user_id: userId, brand_id: brandId });
}

export async function unfollowBrand(userId: string, brandId: string): Promise<void> {
  await supabase.from('brand_follows').delete().eq('user_id', userId).eq('brand_id', brandId);
}
