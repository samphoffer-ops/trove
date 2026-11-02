// deno test supabase/functions/go/
import { assertEquals } from 'jsr:@std/assert@1';
import { ClickOut, createHandler, Deps } from './handler.ts';

const USER = '6f1c2b3a-1234-4abc-9def-0123456789ab';
const PRODUCTS: Record<string, { id: string; url: string; status: string }> = {
  'shop-123': { id: 'shop-123', url: 'https://brand.example/products/tee', status: 'active' },
  'gone-1':   { id: 'gone-1', url: 'https://brand.example/products/old', status: 'removed' },
  'bad-url':  { id: 'bad-url', url: 'javascript:alert(1)', status: 'active' },
};

function setup(overrides: Partial<Deps> = {}) {
  const logged: ClickOut[] = [];
  const pending: Promise<unknown>[] = [];
  const handler = createHandler({
    findActiveProduct: async (id) => {
      const p = PRODUCTS[id];
      return p && p.status === 'active' ? { id: p.id, url: p.url } : null;
    },
    logClickOut: async (click) => { logged.push(click); },
    defer: (work) => { pending.push(work); },
    ...overrides,
  });
  const go = async (query: string, method = 'GET') => {
    const res = await handler(new Request(`http://localhost/go?${query}`, { method }));
    await Promise.all(pending);
    return res;
  };
  return { go, logged };
}

Deno.test('valid active product: 302 to the stored brand URL, click logged once', async () => {
  const { go, logged } = setup();
  const res = await go(`p=shop-123&u=${USER}`);
  assertEquals(res.status, 302);
  assertEquals(res.headers.get('Location'), 'https://brand.example/products/tee');
  assertEquals(res.headers.get('Cache-Control'), 'no-store');
  assertEquals(logged, [{ userId: USER, productId: 'shop-123', url: 'https://brand.example/products/tee' }]);
});

Deno.test('unknown product: 404, nothing logged', async () => {
  const { go, logged } = setup();
  const res = await go(`p=nope&u=${USER}`);
  assertEquals(res.status, 404);
  assertEquals(res.headers.get('Location'), null);
  assertEquals(logged.length, 0);
});

Deno.test('inactive product: 404', async () => {
  const { go } = setup();
  assertEquals((await go('p=gone-1')).status, 404);
});

Deno.test('missing or oversized product id: 400', async () => {
  const { go } = setup();
  assertEquals((await go('')).status, 400);
  assertEquals((await go('url=https://evil.example')).status, 400);
  assertEquals((await go(`p=${'x'.repeat(201)}`)).status, 400);
});

Deno.test('no open redirect: client-supplied destinations are ignored', async () => {
  const { go } = setup();
  for (const q of [
    'p=shop-123&url=https://evil.example',
    'p=shop-123&redirect=https://evil.example&to=//evil.example',
    `p=${encodeURIComponent('https://evil.example')}`,
    `p=${encodeURIComponent('//evil.example')}`,
  ]) {
    const res = await go(q);
    const location = res.headers.get('Location');
    if (location !== null) assertEquals(new URL(location).host, 'brand.example');
  }
  // A product id that is itself a URL is just an unknown id.
  assertEquals((await go(`p=${encodeURIComponent('https://evil.example')}`)).status, 404);
});

Deno.test('non-http stored URL is refused, not redirected to', async () => {
  const { go } = setup();
  const res = await go('p=bad-url');
  assertEquals(res.status, 404);
  assertEquals(res.headers.get('Location'), null);
});

Deno.test('signed out or malformed user: still redirects, not logged', async () => {
  const { go, logged } = setup();
  assertEquals((await go('p=shop-123')).status, 302);
  assertEquals((await go('p=shop-123&u=not-a-uuid')).status, 302);
  assertEquals(logged.length, 0);
});

Deno.test('HEAD redirects without logging; POST is rejected', async () => {
  const { go, logged } = setup();
  assertEquals((await go(`p=shop-123&u=${USER}`, 'HEAD')).status, 302);
  assertEquals((await go(`p=shop-123&u=${USER}`, 'POST')).status, 405);
  assertEquals(logged.length, 0);
});

Deno.test('logging failure never blocks the redirect', async () => {
  const { go } = setup({ logClickOut: () => Promise.reject(new Error('fk violation')) });
  assertEquals((await go(`p=shop-123&u=${USER}`)).status, 302);
});

Deno.test('lookup failure: 502, no redirect', async () => {
  const { go } = setup({ findActiveProduct: () => Promise.reject(new Error('db down')) });
  const res = await go('p=shop-123');
  assertEquals(res.status, 502);
  assertEquals(res.headers.get('Location'), null);
});

Deno.test('affiliate wrapping applied server-side when configured', async () => {
  const { go, logged } = setup({ skimlinksPublisherId: '12345X678' });
  const res = await go(`p=shop-123&u=${USER}`);
  const location = new URL(res.headers.get('Location')!);
  assertEquals(location.host, 'go.skimresources.com');
  assertEquals(location.searchParams.get('id'), '12345X678');
  assertEquals(location.searchParams.get('url'), 'https://brand.example/products/tee');
  assertEquals(location.searchParams.get('xcust'), 'shop123');
  assertEquals(logged[0].url, location.toString());
});
