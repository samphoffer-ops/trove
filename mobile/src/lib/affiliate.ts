import { Product } from '@/types';

// Wraps an outbound product URL in a Skimlinks redirect so the click can be
// attributed and monetized, once EXPO_PUBLIC_SKIMLINKS_PUBLISHER_ID is set.
// Until then, this is a no-op — the raw brand URL opens directly, same as today.
// Format per Skimlinks' server-side link wrapper (no JS snippet needed, works for apps):
// https://go.skimresources.com/?id=<publisherId>&url=<destination>&xcust=<tracking>
export function getAffiliateUrl(product: Product): string {
  const publisherId = process.env.EXPO_PUBLIC_SKIMLINKS_PUBLISHER_ID;
  if (!publisherId) return product.url;

  const xcust = product.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 50);
  const params = new URLSearchParams({ id: publisherId, url: product.url, xcust });
  return `https://go.skimresources.com/?${params.toString()}`;
}
