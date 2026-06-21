import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';

// Picks an image from the library, uploads it to the given Storage bucket
// at `${pathPrefix}/${fileName}.<ext>`, and returns its public URL. The
// storage RLS policies (migration 008) key off the folder segment
// (pathPrefix), not the file name — keep that in sync if either changes.
// RN's fetch().arrayBuffer() is the documented-safe way to get upload bytes
// here — Blob has known compatibility gaps in this environment.
export async function pickAndUploadImage(bucket: string, pathPrefix: string, fileName: string): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    quality: 0.8,
  });
  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  const ext = (asset.uri.split('.').pop() || 'jpg').toLowerCase().split('?')[0];
  const path = `${pathPrefix}/${fileName}.${ext}`;

  const response = await fetch(asset.uri);
  const arrayBuffer = await response.arrayBuffer();
  const contentType = asset.mimeType ?? (ext === 'png' ? 'image/png' : 'image/jpeg');

  const { error } = await supabase.storage.from(bucket).upload(path, arrayBuffer, { contentType, upsert: true });
  if (error) { console.error('pickAndUploadImage:', error); return null; }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`; // cache-bust so a replaced image shows immediately
}
