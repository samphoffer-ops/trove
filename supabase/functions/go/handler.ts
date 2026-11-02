// The single click-out endpoint (#27). Every "Shop at [Brand]" tap opens
// GET /functions/v1/go?p=<productId>&u=<userId> in the browser, and this
// answers with a 302 to the brand's site.
//
// Never an open redirect: the destination is always products.url for an
// active product, read server-side. Nothing in the request picks where the
// redirect goes; any url=/redirect= params are simply ignored.
//
// This is also the one source of truth for click_out events. The app no
// longer logs them itself, so each tap is counted exactly once, here.
//
// Kept free of Deno/Supabase globals so it can be tested with stubs
// (handler_test.ts); index.ts wires in the real database.

export type ActiveProduct = { id: string; url: string };

export type ClickOut = { userId: string; productId: string; url: string };

export type Deps = {
  // Returns the product only if it exists and is active, else null.
  findActiveProduct: (id: string) => Promise<ActiveProduct | null>;
  logClickOut: (click: ClickOut) => Promise<void>;
  // Keeps logging alive after the response is sent (EdgeRuntime.waitUntil).
  defer: (work: Promise<unknown>) => void;
  skimlinksPublisherId?: string;
};

const MAX_ID_LENGTH = 200;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Same Skimlinks server-side wrapper the app used to build client-side:
// https://go.skimresources.com/?id=<publisherId>&url=<destination>&xcust=<tracking>
// Without a publisher ID it's a no-op and the raw brand URL is used.
export function affiliateUrl(product: ActiveProduct, publisherId?: string): string {
  if (!publisherId) return product.url;
  const xcust = product.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 50);
  const params = new URLSearchParams({ id: publisherId, url: product.url, xcust });
  return `https://go.skimresources.com/?${params.toString()}`;
}

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}

function text(status: number, body: string): Response {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export function createHandler(deps: Deps) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return text(405, 'Method not allowed');

    const params = new URL(req.url).searchParams;
    const productId = params.get('p')?.trim() ?? '';
    if (!productId || productId.length > MAX_ID_LENGTH) return text(400, 'Missing product');

    let product: ActiveProduct | null;
    try {
      product = await deps.findActiveProduct(productId);
    } catch (e) {
      console.error('[go] product lookup failed:', e);
      return text(502, 'Could not look up product');
    }
    // A stored URL that isn't http(s) is treated like a missing product
    // rather than handed to the browser.
    if (!product || !isHttpUrl(product.url)) return text(404, 'Product not found');

    const destination = affiliateUrl(product, deps.skimlinksPublisherId);

    // Only real taps count: HEAD (link checkers, previews) redirects
    // without logging. Signed-out taps aren't logged, same as the app's
    // own event logger, since events.user_id is required.
    const userId = params.get('u') ?? '';
    if (req.method === 'GET' && UUID.test(userId)) {
      deps.defer(
        deps.logClickOut({ userId, productId: product.id, url: destination })
          .catch(e => console.error('[go] click_out not logged:', e)),
      );
    }

    return new Response(null, {
      status: 302,
      headers: { Location: destination, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
    });
  };
}
