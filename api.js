// ---------------------------------------------------------------
// Skimlinks Product API
//
// Sign up:  https://skimlinks.com (Publisher Hub)
// Docs:     https://developers.skimlinks.com/product-api
//
// Once you have credentials, replace the two values below and
// set USE_MOCK_DATA = false.
// ---------------------------------------------------------------

const SKIMLINKS_CONFIG = {
  apiKey:      'YOUR_API_KEY_HERE',
  publisherId: 'YOUR_PUBLISHER_ID_HERE',
};

const USE_MOCK_DATA = SKIMLINKS_CONFIG.apiKey === 'YOUR_API_KEY_HERE';

// Skimlinks category path strings — verify/extend from their docs
const CATEGORY_MAP = {
  all:         null,
  clothing:    'clothing-shoes-jewelry/clothing',
  shoes:       'clothing-shoes-jewelry/shoes',
  bags:        'clothing-shoes-jewelry/handbags-wallets',
  accessories: 'clothing-shoes-jewelry/accessories',
  home:        'home-kitchen',
  beauty:      'beauty',
  tech:        'electronics',
  jewelry:     'clothing-shoes-jewelry/jewelry',
};

const RATIOS = [1.25, 0.8, 1.4, 1.1, 0.95, 1.3, 1.15, 0.85, 1.35, 1.0, 1.2, 0.9];

// Main entry point used by app.js
// Returns { products: [...], hasMore: bool }
async function getProducts({ category = 'all', query = '', page = 1, perPage = 20 } = {}) {
  if (USE_MOCK_DATA) {
    return getMockProducts({ category, page, perPage });
  }
  return getSkimlinkProducts({ category, query, page, perPage });
}

async function getSkimlinkProducts({ category, query, page, perPage }) {
  const params = new URLSearchParams({
    api_key: SKIMLINKS_CONFIG.apiKey,
    pub_id:  SKIMLINKS_CONFIG.publisherId,
    page,
    num:     perPage,
    locale:  'US',
  });

  const categoryPath = CATEGORY_MAP[category];
  if (categoryPath) params.set('category', categoryPath);
  if (query)        params.set('q', query);

  const res = await fetch(`https://api.skimlinks.com/products/v2/search?${params}`, {
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) throw new Error(`Skimlinks ${res.status}`);

  const data = await res.json();

  // Field names to verify against Skimlinks docs when you get access.
  // Common fields: products[], id, name, merchant_name, price, image_url, url
  const products = (data.products ?? []).map((item, i) => ({
    id:    String(item.id ?? item.product_id ?? i),
    brand: item.merchant_name ?? item.brand ?? '',
    name:  item.name ?? item.title ?? '',
    price: parseFloat(item.price ?? item.sale_price ?? 0),
    image: item.image_url ?? item.image ?? '',
    url:   item.url ?? item.product_url ?? '#',
    ratio: RATIOS[i % RATIOS.length],
  }));

  const hasMore = products.length === perPage;
  return { products, hasMore };
}

// ── Mock fallback (uses static PRODUCTS from data.js) ────────────
async function getMockProducts({ category, page, perPage }) {
  await new Promise(r => setTimeout(r, 500)); // simulate latency

  const filtered = category === 'all'
    ? PRODUCTS
    : PRODUCTS.filter(p => p.category === category);

  const start   = (page - 1) * perPage;
  const slice   = filtered.slice(start, start + perPage);
  const hasMore = start + perPage < filtered.length;

  return { products: slice, hasMore };
}
