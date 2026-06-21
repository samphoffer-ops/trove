import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
  'image/gif':  'gif',
};

interface UploadResult {
  url: string | null;
  error?: string;
}

// Picks an image from the library, uploads it to the given Storage bucket
// at `${pathPrefix}/${fileName}.<ext>`, and returns its public URL. The
// storage RLS policies (migration 008) key off the folder segment
// (pathPrefix), not the file name — keep that in sync if either changes.
//
// Extension comes from asset.mimeType, never from asset.uri — on web,
// launchImageLibraryAsync returns a blob: URL with no file extension at
// all, so parsing it from the URI produces garbage (the whole blob: URL)
// and an invalid storage path, which used to fail the upload silently.
//
// RN's fetch().arrayBuffer() is the documented-safe way to get upload bytes
// here — Blob has known compatibility gaps in this environment.
export async function pickAndUploadImage(bucket: string, pathPrefix: string, fileName: string): Promise<UploadResult> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return { url: null, error: 'Permission to access your photos was denied.' };

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    quality: 0.8,
  });
  if (result.canceled || !result.assets[0]) return { url: null };

  const asset = result.assets[0];
  const mimeType = asset.mimeType ?? 'image/jpeg';
  const ext = EXT_BY_MIME[mimeType] ?? 'jpg';
  const path = `${pathPrefix}/${fileName}.${ext}`;

  try {
    const response = await fetch(asset.uri);
    const arrayBuffer = await response.arrayBuffer();

    const { error } = await supabase.storage.from(bucket).upload(path, arrayBuffer, { contentType: mimeType, upsert: true });
    if (error) return { url: null, error: error.message };

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return { url: `${data.publicUrl}?t=${Date.now()}` }; // cache-bust so a replaced image shows immediately
  } catch (err) {
    return { url: null, error: String(err) };
  }
}
