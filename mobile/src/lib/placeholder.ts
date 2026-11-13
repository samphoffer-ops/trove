// Spec §6: product images load over their blurhash, never an empty box
// (#108). The hash is computed by catalog-intake from the image itself.
// Products without one yet ('' or missing: not backfilled, or the image
// couldn't be read) get no placeholder, so the frame's own background
// shows, as before. Pair with placeholderContentFit="cover" so the hash
// fills the frame whatever the image's own fit.
export function productPlaceholder(blurhash?: string | null) {
  return blurhash ? { blurhash } : undefined;
}
