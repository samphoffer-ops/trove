// Spec §6: product images load over their blurhash, never an empty box
// (#108). The hash is computed by catalog-intake from the image itself.
// Products without one yet ('' or missing: not backfilled, or the image
// couldn't be read) get no placeholder, so the frame's own background
// shows, as before.
//
// On iOS, expo-image draws a hash placeholder with the image's own
// contentFit and ignores placeholderContentFit. Product images use
// "contain" (never cropped), so a square hash in a tall frame was
// letterboxed, with the frame's gray above and below. Pass the product's
// `ratio` (products.ratio, height / width): the hash is decoded at that
// shape, which is the frame's shape wherever the image is shown uncropped.
// Always pass the stored ratio, never a frame's measured one: expo-image
// caches the decoded placeholder by hash alone, so one product decoded at
// two shapes shows whichever came first everywhere.
// placeholderContentFit="cover" still matters on web.
export function productPlaceholder(blurhash?: string | null, ratio = 1) {
  if (!blurhash) return undefined;
  const r = ratio > 0 && Number.isFinite(ratio) ? ratio : 1;
  return { blurhash, width: 32, height: Math.max(1, Math.round(32 * r)) };
}
