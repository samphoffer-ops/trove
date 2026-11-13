import { encode } from 'npm:blurhash@2.0.5';
import jpeg from 'npm:jpeg-js@0.4.4';
import upng from 'npm:upng-js@2.1.0';

// upng-js ships no types.
const UPNG = upng as any;

// Blurhash placeholders (#108, spec §6 "never show empty gray boxes"). The
// app shows the hash while the real image loads. The stored image URL is
// never changed. The hash is computed from a small copy of the image and
// nothing else is written back.
//
// Shopify's image CDN (cdn.shopify.com and every store's own /cdn/shop/ path)
// serves a small derivative of the same photo for `width=`, and Squarespace
// does the same for `format=100w`. Both serve JPEG or PNG when the Accept
// header doesn't offer WebP. Requesting the small copy keeps a backfill of the whole
// catalog cheap. Other hosts serve the original
// file, so it's capped at MAX_BYTES and only JPEG and PNG are decoded. Any
// other format, or any failure, returns null, and the app falls back to its
// plain placeholder color for that product.

// Edge Functions get about 2s of CPU per request (WORKER_RESOURCE_LIMIT
// past it), and decoding is CPU. A 16px-wide copy costs ~0.3ms to decode
// and hash; 32px cost 4x that, and a first live backfill call of 400 died.
// Originals from other hosts are capped at 1MP, so one large photo can't
// use up a call's budget; bigger ones get no hash ('').
const HASH_WIDTH = 16;
const MAX_BYTES = 1_500_000;
const MAX_PIXELS = 1_000_000; // jpeg-js decodes the full image to RGBA
const FETCH_TIMEOUT_MS = 8000;
// 4x3 components: enough for a soft light-to-dark field without banding,
// and a 28-character string.
const X_COMPONENTS = 3;
const Y_COMPONENTS = 4;

function hashUrl(image: string): string | null {
  let u: URL;
  // Some stores' feeds give protocol-relative URLs ("//host/...").
  try { u = new URL(image.startsWith('//') ? `https:${image}` : image); } catch { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  if (u.hostname === 'cdn.shopify.com' || u.pathname.startsWith('/cdn/shop/')) {
    // A legacy size suffix in the filename ("_2048x.jpg") wins over width=.
    u.pathname = u.pathname.replace(/_(\d+x\d*|\d*x\d+)(?=\.\w+$)/, '');
    u.searchParams.set('width', String(HASH_WIDTH));
  } else if (u.hostname.endsWith('squarespace-cdn.com') || u.hostname.endsWith('squarespace.com')) {
    u.searchParams.set('format', '100w');
  }
  return u.toString();
}

function encodeRgba(data: Uint8Array, width: number, height: number): string | null {
  if (!width || !height || data.length < width * height * 4) return null;
  // blurhash's cost grows with pixel count, so large non-Shopify originals
  // are sampled down to about HASH_WIDTH across by nearest pixel first.
  const step = Math.max(1, Math.floor(Math.min(width, height) / HASH_WIDTH));
  const w = Math.floor(width / step), h = Math.floor(height / step);
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const s = ((y * step) * width + x * step) * 4, d = (y * w + x) * 4;
      px[d] = data[s]; px[d + 1] = data[s + 1]; px[d + 2] = data[s + 2]; px[d + 3] = 255;
    }
  }
  return encode(px, w, h, X_COMPONENTS, Y_COMPONENTS);
}

export function blurhashFromBytes(bytes: Uint8Array): string | null {
  try {
    if (bytes[0] === 0xff && bytes[1] === 0xd8) {
      const img = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true, maxResolutionInMP: MAX_PIXELS / 1e6 });
      return encodeRgba(img.data, img.width, img.height);
    }
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
      const img = UPNG.decode(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
      if (img.width * img.height > MAX_PIXELS) return null;
      return encodeRgba(new Uint8Array(UPNG.toRGBA8(img)[0]), img.width, img.height);
    }
  } catch { /* corrupt or unsupported variant: no placeholder */ }
  return null;
}

export async function blurhashForImage(image: string): Promise<string | null> {
  const url = hashUrl(image);
  if (!url) return null;
  try {
    // Image CDNs negotiate the format. Only JPEG and PNG decode here.
    const res = await fetch(url, { headers: { Accept: 'image/jpeg,image/png;q=0.9' }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) { await res.body?.cancel(); return null; }
    const len = Number(res.headers.get('content-length') ?? 0);
    if (len > MAX_BYTES) { await res.body?.cancel(); return null; }
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length > MAX_BYTES) return null;
    return blurhashFromBytes(bytes);
  } catch {
    return null;
  }
}

// Hashes many images with a few fetches in flight, stopping early once
// `deadline` (epoch ms) passes. Images not reached are left out of the
// result, so callers can tell "not tried" from "tried, no hash" (null).
export async function blurhashMany(images: string[], deadline: number, concurrency = 8): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  const queue = [...new Set(images)];
  const worker = async () => {
    while (queue.length > 0 && Date.now() < deadline) {
      const image = queue.shift()!;
      out.set(image, await blurhashForImage(image));
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  return out;
}
