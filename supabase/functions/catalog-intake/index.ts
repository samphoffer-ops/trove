import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Catalog intake: given a list of candidate brand domains, probes each for
// scrapeability (Shopify products.json, or sitemap + ld+json), runs a cheap
// deterministic pre-filter, then a single LLM judgment call per brand against
// the Trove taste rubric below. Every brand that passes the pre-filter lands
// in `brands` as 'pending_review' — Sam approves/rejects every one by hand in
// the Supabase Table Editor (see supabase/migrations/006_products.sql comment
// "no public insert/update policy" — writes only happen via this function's
// service-role key). Re-running against an already-`approved` brand instead
// refreshes its products (price/stale/removed) without touching brand status.
//
// NOT built here: autonomous brand *discovery* (deciding which domains to try
// in the first place) — that needs a web-search API decision Sam hasn't made
// yet. Call this function with a `domains` array; something else (Sam, or a
// future discovery step) decides what goes in that array.

const RUBRIC = `You are the brand judge for Trove, a curated shopping discovery app. Your job
is to decide whether a brand belongs in Trove's catalog. Be strict — it is better
to reject a borderline brand than to let the catalog drift generic.

━━━ WHO TROVE IS FOR ━━━

Trove's customer defines themselves through taste, not income. They'd rather be
the person who *found* a brand than the person visibly wearing the expensive one.
They discover brands through friends' closets, algorithmic feeds, and rabbit holes
— not department stores or traditional ads. Their wardrobe mixes a few real splurge
pieces ($400 boots) with thrifted finds and a $60 t-shirt from a label they love.
They read Highsnobiety, Cool Hunting, Wallpaper, and style-forward TikTok — not
Vogue runway or traditional luxury media.

Two overlapping sub-personas the catalog must serve (do not average them into a
bland middle — serve both):
• Downtown/design-forward (skews 25–40): Bode, Story Mfg., Online Ceramics,
  Imogene & Willie, 3sixteen — craft- and narrative-driven, willing to spend more
  for the story
• Streetwear/prep-adjacent (skews 18–28): Aimé Leon Dore, Rowing Blazers, Cherry
  LA, Every Other Thursday — collab-driven, slightly more price-sensitive, graphic-
  and logo-aware

━━━ THE AESTHETIC ━━━

Core words: cool, considered, downtown, off-duty, quietly confident, craft-driven,
a little irreverent. A brand with a point of view — not just clean minimalism, and
not necessarily quiet. Texture and personality (graphics, color, print) are welcome
when they're driven by identity and craft, not trend-chasing.

Think: "grew up skating or in a design studio" — not "grew up in private equity."

━━━ POSITIVE SIGNALS (each one tilts toward approve) ━━━

• Editorial-style product photography shot on location — not white-seamless studio
• A founder/small-team story on the site with a real point of view, not corporate
  mission-statement language
• Specific, idiosyncratic copy voice (a weird reference is a good sign; "elevated
  essentials for the modern woman" is a red flag)
• Limited drops / seasonal releases rather than infinite restocked SKUs
• Genuine creative collaborations with other small brands, artists, cultural figures
• Specific material/construction language: "13oz Japanese selvedge," "vegetable-
  tanned leather," "direct-trade cotton" — not vague "premium fabric"
• A founding story with real obsession: denim-obsessive, workwear-obsessive,
  moodboard-turned-brand

━━━ NEGATIVE SIGNALS (each one tilts toward reject) ━━━

• Generic template-feeling site with stock lifestyle photography
• Infinite core basics with seasonal color drops only, no design point of view
• Heavy discount/sale culture, constant promo banners
• Primarily sold through mass e-commerce aggregators (Amazon, Walmart.com)
• Marketing that leans on "as seen on" celebrity dressing rather than product story

━━━ THE SCALE RULE (apply carefully) ━━━

Scale alone does NOT disqualify a brand. Free People is large and widely distributed
but still reads as a strong yes — the photography, copy voice, and design point of
view have stayed intact as it's grown.

The question is: has scale eroded the specificity of the product, photography, and
voice — or has it stayed intact?

Reject when scale has caused the design to get safer and more generic
(Reformation, Marine Layer — both were once good fits, both drifted into wide
retail and lost their edge). Reject when corporate ownership has flattened the
aesthetic (Madewell — right price and occasional right aesthetic, but J.Crew-owned
mall brand where the point of view has been sanded down). Distribution footprint is
a signal to investigate, not an automatic disqualifier.

━━━ PRICE FLOORS & CEILINGS (by category) ━━━

If sample products are BELOW these floors, reject unless there is a clear heritage,
craft, or brand-identity story that justifies the price (e.g. a 60-year-old brand
with dominant brand equity). If products are ABOVE these ceilings, the brand likely
serves a quiet-luxury or investment-dressing customer, not Trove's.

T-shirts / basics: floor $40, typical $60–90, ceiling $120
Button-ups / shirting: floor $80, typical $120–180, ceiling $250
Denim: floor $100, typical $150–220, ceiling $300
Outerwear / jackets: floor $150, typical $250–450, ceiling $700
Footwear: floor $100, typical $180–300, ceiling $450
Boots (leather): floor $150, typical $250–400, ceiling $600
Bags / leather goods: floor $80, typical $150–300, ceiling $500
Knitwear: floor $100, typical $150–250, ceiling $400
Accessories (socks, small leather goods): floor $20, typical $30–60, ceiling $100
Jewelry / fine accessories: floor $40, typical $80–300, ceiling $600
Eyewear / sunglasses: floor $60, typical $120–250, ceiling $400
Hats / caps: floor $30, typical $50–100, ceiling $200

Note: accessories are a CORE category for Trove, not secondary. A brand whose
primary catalog is accessories (jewelry, hats, bags, belts, eyewear, scarves,
socks) should be judged on the same aesthetic and craft standards as clothing —
do not downgrade it simply because it doesn't sell apparel.

━━━ APPROVED REFERENCE BRANDS (these are YES — use as your calibration) ━━━

Aimé Leon Dore, Bode, Story Mfg., Online Ceramics, Sporty & Rich, Rowing Blazers,
Corridor NYC, Wellen, Cherry LA, Alex Crane, Kapital, Toogood, Every Other Thursday,
Free People, Imogene & Willie, Noah NYC, 3sixteen, Taylor Stitch, Jungmaven, Dôen,
Sézane, Faherty, Birdwell, Kotn, Le Bon Shoppe.

━━━ REJECT-WITH-REASON REFERENCE BRANDS (use for calibration) ━━━

The Row — right craft, wrong customer (quiet-luxury/investment-dressing, $1000+ core)
Everlane — right price, but no point of view ("transparent pricing" is a value prop
  not an aesthetic)
Reformation — was a yes; scaled into wide wholesale distribution, design got safer
Vuori, Alo Yoga — right price, but athletic/performance-first, no downtown edge
Madewell — right price, occasionally right aesthetic, but J.Crew-owned mall brand
Marine Layer — right price and casualness, but drifted to generic-comfortable

━━━ EXPLICIT REJECTIONS (hard rules — apply without exception) ━━━

• Fast fashion: Zara, H&M, Shein, Forever 21 — production cycle and quality tell
• Mass/big-box: Gap, Old Navy, Target private label
• Corporate athleisure: Lululemon, Vuori, Alo Yoga — too polished, no edge
• Big-logo hype/resale-driven: Supreme, sneaker-bot culture — different customer
  motivation (scarcity/flip value, not taste)
• Bohemian/boho-chic/cottagecore: flowy dresses, macramé, festival-market aesthetic,
  Etsy-adjacent handmade — confirmed miss for this customer
• Golf apparel as the core catalog (a brand with cultural tie to golf is fine;
  a brand whose *catalog* IS golf wear is not)
• Mainstream/mass-retail home goods recognizable from a big-box store aisle
• Unfocused "general store" catalogs (stationery + wallets + kids + candles — no
  clear identity)
• Beauty/skincare with clinical, dermatological, anti-aging-forward positioning
• Corporate-formal tailoring built for office wear — Trove skews effortless/casual
• Children's/kids' clothing as the primary catalog
• Brands narrowly tied to a single life event (wedding, baby shower)
• "Instagram ad basics" brands that exist purely as a performance-marketing funnel
  with no story`;

const MAX_DOMAINS_PER_RUN = 15;
const REQUEST_DELAY_MS = 1500;

interface ScrapedProduct {
  handle: string;
  name: string;
  price: number;                   // always USD — see migration 024
  prices: Record<string, number>;  // real (non-converted) prices by currency code
  image: string;
  images?: string[];
  ratio: number;
  url: string;
  description?: string;
}

interface ScrapeResult {
  products: ScrapedProduct[];
  platform: 'shopify' | 'ld_json';
  feedDomain: string | null;  // set when products.json lives on a different host than the brand domain
  currency: string;           // the store's base currency
  hasUsdPricing: boolean;     // store serves its own US-market prices (vs. us converting)
  // Shopify: every page of products.json was read to the end, so anything
  // not seen this run is genuinely gone from the store and safe to mark
  // removed. Never true for ld_json, which only covers a window per run.
  complete: boolean;
  nextCursor: number;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Several brand sites silently hang instead of erroring (confirmed via direct
// test: blundstoneusa.com and commonprojects.com never respond at all to a
// plain products.json request, no timeout, no 403 — just nothing). Plain
// `fetch()` has no timeout of its own, so one unresponsive site can eat the
// function's entire ~150s execution budget by itself and take the whole
// batch down with it (this is what WORKER_RESOURCE_LIMIT actually was, not
// a memory problem). Every external fetch in this file goes through this
// wrapper so a hung site fails fast instead.
const FETCH_TIMEOUT_MS = 10000;
function fetchWithTimeout(url: string, init: RequestInit = {}) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

async function isDisallowed(domain: string): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(`https://${domain}/robots.txt`, { headers: { 'User-Agent': 'TroveCatalogBot/1.0' } });
    if (!res.ok) return false;
    const text = await res.text();
    const lines = text.split('\n').map(l => l.trim());
    let underWildcard = false;
    for (const line of lines) {
      if (/^user-agent:\s*\*/i.test(line)) { underWildcard = true; continue; }
      if (/^user-agent:/i.test(line)) { underWildcard = false; continue; }
      if (underWildcard && /^disallow:\s*\/(products\.json)?\s*$/i.test(line)) return true;
    }
    return false;
  } catch {
    return false; // unreachable robots.txt — don't block on a network blip
  }
}

const BOT_HEADERS = { 'User-Agent': 'TroveCatalogBot/1.0' };

async function fetchJson(url: string): Promise<any | null> {
  try {
    const res = await fetchWithTimeout(url, { headers: BOT_HEADERS });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ── Currency ────────────────────────────────────────────────────────────
// Daily ECB rates via frankfurter.dev (free, no key), cached in fx_rates so
// the app can read the same numbers and so a frankfurter outage doesn't
// stop scraping — yesterday's rate is fine, a missing rate is not.
// rates[X] = units of X per 1 USD.
let fxCache: { rates: Record<string, number>; at: number } | null = null;
const FX_MAX_AGE_MS = 20 * 60 * 60 * 1000;

async function getUsdRates(admin: any): Promise<Record<string, number>> {
  if (fxCache && Date.now() - fxCache.at < FX_MAX_AGE_MS) return fxCache.rates;
  const rates: Record<string, number> = { USD: 1 };
  let newest = 0;
  const { data: stored } = await admin.from('fx_rates').select('currency, rate, updated_at');
  for (const r of stored ?? []) {
    rates[r.currency] = Number(r.rate);
    newest = Math.max(newest, new Date(r.updated_at).getTime());
  }
  if (Date.now() - newest > FX_MAX_AGE_MS) {
    const fresh = await fetchJson('https://api.frankfurter.dev/v1/latest?base=USD');
    if (fresh?.rates) {
      Object.assign(rates, fresh.rates);
      const now = new Date().toISOString();
      await admin.from('fx_rates').upsert(
        Object.entries(fresh.rates).map(([currency, rate]) => ({ currency, rate, updated_at: now })),
      );
    }
  }
  fxCache = { rates, at: Date.now() };
  return rates;
}

function toUsd(amount: number, currency: string, fx: Record<string, number>): number | null {
  if (currency === 'USD') return amount;
  const rate = fx[currency];
  return rate ? Math.round((amount / rate) * 100) / 100 : null;
}

// ── Shopify ─────────────────────────────────────────────────────────────
// products.json caps at 250 per page. This used to read only page one, so
// every brand with a bigger catalog was silently truncated (106 of 190
// approved brands, measured 2026-09-26) — and whatever the first page
// happened to hold, including sold-out archive pieces.
const SHOPIFY_PAGE_SIZE = 250;
const SHOPIFY_MAX_PAGES = 8;
const MAX_PRODUCTS_PER_BRAND = 1000;

// Headless Shopify stores (custom front end, e.g. aetherapparel.com) 404 on
// /products.json at the brand domain but still serve it from the Shopify
// host behind the front end, conventionally a shop./store. subdomain.
async function findShopifyFeedHost(domain: string, known: string | null): Promise<string | null> {
  const hosts = [...new Set([known, domain, `shop.${domain}`, `store.${domain}`].filter(Boolean) as string[])];
  for (const host of hosts) {
    // limit=10, not 1 — some stores answer limit=1 with an empty list
    // (saltmurphy.com does, presumably a hidden first product) while
    // serving their full catalog on any larger page.
    const data = await fetchJson(`https://${host}/products.json?limit=10`);
    if (Array.isArray(data?.products) && data.products.length > 0) return host;
  }
  return null;
}

function mapShopifyProduct(p: any, domain: string) {
  // First in-stock variant's price, not variants[0] — the first variant is
  // often a sold-out size with a stale price.
  const variants: any[] = p.variants ?? [];
  const variant = variants.find(v => v.available !== false) ?? variants[0];
  const img = p.images?.[0];
  const allImages: string[] = (p.images ?? []).map((i: any) => i?.src).filter(Boolean);
  return {
    id: p.id as number,
    inStock: variants.some(v => v.available !== false),
    price: parseFloat(variant?.price ?? '0'),
    product: {
      handle: p.handle,
      name: p.title,
      image: img?.src ?? '',
      images: allImages.length > 1 ? allImages : undefined,
      ratio: img?.width && img?.height ? img.height / img.width : 1.25,
      // Always the brand's own domain, never the feed host — a headless
      // store's shop. subdomain is a backend, not where shoppers should land.
      url: `https://${domain}/products/${p.handle}`,
      description: (p.body_html ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300),
    },
  };
}

async function readShopifyPages(host: string, currencyParam: string, maxPages: number) {
  const raw: any[] = [];
  let complete = false;
  for (let page = 1; page <= maxPages; page++) {
    if (page > 1) await sleep(500);
    const data = await fetchJson(`https://${host}/products.json?limit=${SHOPIFY_PAGE_SIZE}&page=${page}${currencyParam}`);
    if (!Array.isArray(data?.products)) return { raw, complete: false }; // a failed page means we can't vouch for what's missing
    raw.push(...data.products);
    if (data.products.length < SHOPIFY_PAGE_SIZE) { complete = true; break; }
  }
  return { raw, complete };
}

async function probeShopify(
  domain: string,
  fx: Record<string, number>,
  opts: { feedDomain?: string | null; maxPages?: number } = {},
): Promise<ScrapeResult | null> {
  const host = await findShopifyFeedHost(domain, opts.feedDomain ?? null);
  if (!host) return null;
  const maxPages = opts.maxPages ?? SHOPIFY_MAX_PAGES;

  // US site first, always. /meta.json gives the store's base currency; a
  // store with Shopify Markets set up for the US answers /cart.js?currency=USD
  // with "USD" and then serves its real US prices on ?currency=USD (which
  // are often NOT a straight conversion — Story mfg.'s £370 piece is $409,
  // not the ~$490 the exchange rate implies, since UK prices include VAT).
  const meta = await fetchJson(`https://${host}/meta.json`);
  const currency: string = (meta?.currency ?? 'USD').toUpperCase();
  let hasUsdPricing = currency === 'USD';
  if (!hasUsdPricing) {
    const cart = await fetchJson(`https://${host}/cart.js?currency=USD`);
    hasUsdPricing = cart?.currency === 'USD';
  }

  // Always name the currency explicitly, even the base one: with no
  // ?currency= Shopify Markets picks one from the requester's geo/headers,
  // so the same request returns GBP from one machine and USD from another.
  const main = await readShopifyPages(host, `&currency=${hasUsdPricing ? 'USD' : currency}`, maxPages);
  // Also keep the base-currency price for non-US stores, so the country
  // picker can show e.g. a UK shopper the brand's real GBP price.
  const basePrices = new Map<number, number>();
  if (currency !== 'USD' && hasUsdPricing) {
    const base = await readShopifyPages(host, `&currency=${currency}`, maxPages);
    for (const p of base.raw) basePrices.set(p.id, mapShopifyProduct(p, domain).price);
  }

  const products: ScrapedProduct[] = [];
  for (const p of main.raw) {
    const m = mapShopifyProduct(p, domain);
    if (!m.inStock || !m.product.image || !(m.price > 0)) continue;
    let price: number | null;
    const prices: Record<string, number> = {};
    if (hasUsdPricing) {
      price = m.price;
      prices.USD = m.price;
      const basePrice = basePrices.get(m.id);
      if (currency !== 'USD' && basePrice) prices[currency] = basePrice;
    } else {
      price = toUsd(m.price, currency, fx);
      prices[currency] = m.price;
    }
    if (price === null) continue; // no FX rate for this currency — never show an unconverted price as USD
    products.push({ ...m.product, price, prices });
    if (products.length >= MAX_PRODUCTS_PER_BRAND) break;
  }
  if (products.length === 0) return null;

  return {
    products,
    platform: 'shopify',
    feedDomain: host === domain ? null : host,
    currency,
    hasUsdPricing,
    complete: main.complete,
    nextCursor: 0,
  };
}

// ── Sitemap + ld+json (non-Shopify) ─────────────────────────────────────
// One page fetch per product, so a big catalog can't fit in one run. Each
// run takes the next LD_PAGES_PER_RUN product URLs from brands.scrape_cursor,
// so daily refreshes walk the whole catalog over several days.
const LD_PAGES_PER_RUN = 40; // ~2s/page measured, keeps a run well inside the ~150s limit
const LD_REQUEST_DELAY_MS = 1000;

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(url, { headers: BOT_HEADERS });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

const locs = (xml: string) => [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map(m => m[1].replace(/&amp;/g, '&'));

// Prefer the US storefront's sitemap when a site publishes one per locale
// (e.g. selected.com's /en-us/sitemap/root), then any English one.
function rankLocale(url: string): number {
  if (/[/_.-]en[-_]us\b|\/us\//i.test(url)) return 0;
  if (/[/_.-]en[-_](gb|int|eu)\b|\/en\//i.test(url)) return 1;
  if (/[/_.-][a-z]{2}[-_][a-z]{2}\b/i.test(url)) return 3; // some other locale
  return 2; // no locale in the URL
}

async function collectSitemapUrls(domain: string): Promise<string[]> {
  // robots.txt's Sitemap: lines first — plenty of stores (Selected included)
  // don't serve anything at /sitemap.xml at all.
  const robots = await fetchText(`https://${domain}/robots.txt`) ?? '';
  const declared = [...robots.matchAll(/^\s*sitemap:\s*(\S+)/gim)].map(m => m[1]);
  const roots = [...new Set([...declared, `https://${domain}/sitemap.xml`])]
    .sort((a, b) => rankLocale(a) - rankLocale(b));

  for (const root of roots.slice(0, 3)) {
    const xml = await fetchText(root);
    if (!xml) continue;
    if (!/<sitemapindex/i.test(xml)) return locs(xml);
    // Index: follow product-looking children first ("products", "pdp"), then
    // whatever else, capped so a sprawling index can't eat the run.
    const children = locs(xml).sort((a, b) =>
      Number(!/product|pdp/i.test(a)) - Number(!/product|pdp/i.test(b)) || rankLocale(a) - rankLocale(b));
    const urls: string[] = [];
    for (const child of children.slice(0, 3)) {
      await sleep(300);
      const childXml = await fetchText(child);
      if (!childXml) continue;
      // One level deeper for index-of-indexes (locale index → type index)
      if (/<sitemapindex/i.test(childXml)) {
        const grand = locs(childXml).find(u => /product|pdp/i.test(u));
        const grandXml = grand ? await fetchText(grand) : null;
        if (grandXml) urls.push(...locs(grandXml));
      } else {
        urls.push(...locs(childXml));
      }
      if (urls.some(looksLikeProductUrl)) break;
    }
    if (urls.length > 0) return urls;
  }
  return [];
}

function looksLikeProductUrl(u: string): boolean {
  return /\/(products?|product-page|shop|item|p)\//i.test(u); // product-page: Wix
}

// One entry per product rather than per colourway — /p/<slug>/<sku_color>
// style URLs (Selected, lots of Salesforce Commerce stores) otherwise spend
// the whole run fetching the same shirt in six colours.
function productGroupKey(u: string): string {
  const m = u.match(/^(.*\/p\/[^/]+)\/[^/]+\/?$/i);
  return m ? m[1] : u;
}

function findLdProduct(html: string): any | null {
  // A page routinely carries several ld+json blocks (Organization,
  // BreadcrumbList, WebSite, then Product) — scan all of them, tolerate
  // attribute order/quote style, and unwrap @graph (common from SEO plugins).
  const blocks = [...html.matchAll(/<script[^>]*\btype=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
  let group: any = null;
  for (const block of blocks) {
    let parsed: any;
    try { parsed = JSON.parse(block); } catch { continue; }
    const nodes = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.['@graph']) ? parsed['@graph'] : [parsed]);
    for (const n of nodes) {
      const type = n?.['@type'];
      const is = (t: string) => type === t || (Array.isArray(type) && type.includes(t));
      if (is('Product')) return n;
      if (is('ProductGroup') && !group) group = n;
    }
  }
  // ProductGroup carries the name/description; price lives on its variants.
  if (group) return { ...group, offers: group.offers ?? group.hasVariant?.[0]?.offers, image: group.image ?? group.hasVariant?.[0]?.image };
  return null;
}

function ldOffer(ld: any): { price: number; currency: string } | null {
  const raw = ld.offers ?? ld.Offers;
  const offers: any[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
  for (const o of offers) {
    const price = parseFloat(o?.price ?? o?.lowPrice ?? o?.priceSpecification?.price ?? '0');
    const currency = String(o?.priceCurrency ?? o?.priceSpecification?.priceCurrency ?? 'USD').toUpperCase();
    if (price > 0) return { price, currency };
  }
  return null;
}

function ldImage(ld: any): string | null {
  const img = Array.isArray(ld.image) ? ld.image[0] : ld.image;
  return (typeof img === 'string' ? img : img?.contentUrl ?? img?.url) ?? null;
}

async function probeLdJson(
  domain: string,
  fx: Record<string, number>,
  opts: { cursor?: number; maxPages?: number } = {},
): Promise<ScrapeResult | null> {
  const rawUrls = await collectSitemapUrls(domain);
  // When the sitemap mixes page types, keep only product-looking URLs. When
  // nothing matches we're guessing blind across whatever pages exist, so cap
  // that case tighter.
  const filtered = rawUrls.filter(looksLikeProductUrl);
  const seen = new Set<string>();
  const productUrls = (filtered.length > 0 ? filtered : rawUrls.slice(0, 15)).filter(u => {
    const key = productGroupKey(u);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (productUrls.length === 0) return null;

  const pageCount = Math.min(opts.maxPages ?? LD_PAGES_PER_RUN, productUrls.length);
  const start = (opts.cursor ?? 0) < productUrls.length ? (opts.cursor ?? 0) : 0;
  const window = [...productUrls.slice(start, start + pageCount), ...productUrls.slice(0, Math.max(0, start + pageCount - productUrls.length))];

  const products: ScrapedProduct[] = [];
  const currencies = new Map<string, number>();
  for (const url of window) {
    await sleep(LD_REQUEST_DELAY_MS);
    const html = await fetchText(url);
    if (!html) continue;
    const ld = findLdProduct(html);
    const offer = ld ? ldOffer(ld) : null;
    const image = ld ? ldImage(ld) : null;
    if (!ld || !offer || !image || !ld.name) continue;
    const price = toUsd(offer.price, offer.currency, fx);
    if (price === null) continue;
    currencies.set(offer.currency, (currencies.get(offer.currency) ?? 0) + 1);
    products.push({
      handle: slugify(ld.productGroupID ?? ld.sku ?? ld.name ?? url),
      name: ld.name,
      price,
      prices: { [offer.currency]: offer.price },
      image,
      ratio: 1.25,
      url,
      description: String(ld.description ?? '').replace(/\s+/g, ' ').trim().slice(0, 300),
    });
  }
  if (products.length === 0) return null;

  const currency = [...currencies.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'USD';
  return {
    products,
    platform: 'ld_json',
    feedDomain: null,
    currency,
    hasUsdPricing: currency === 'USD',
    complete: false,
    nextCursor: (start + pageCount) % productUrls.length,
  };
}

// Scrapes a brand's full current catalog and writes it in bulk.
//
// This used to embed (Voyage) and keyword (Anthropic) every product inline,
// then upsert one row at a time — for a 250-product brand that's hundreds of
// sequential round-trips, which routinely ran past the Edge Function's time
// limit and got killed partway (Taylor Stitch had 45 of 2,000+ products,
// Schott 2 of 439). Now products land in a few bulk upserts and leave
// embedding / search_keywords empty; the backfill-catalog workflow (every
// 20 min) fills those in, which it was already built to do. Omitted columns
// aren't touched on conflict, so existing products keep theirs.
const PRODUCT_UPSERT_CHUNK = 200;

async function refreshBrand(admin: any, brand: any, fx: Record<string, number>) {
  const runStart = new Date().toISOString();
  const shopify = () => probeShopify(brand.domain, fx, { feedDomain: brand.feed_domain });
  const ld = () => probeLdJson(brand.domain, fx, { cursor: brand.scrape_cursor ?? 0 });
  // Try the platform we last saw first, then the other — stores do migrate.
  const scrape = brand.platform === 'ld_json' ? (await ld() ?? await shopify()) : (await shopify() ?? await ld());
  if (!scrape) return { count: 0, removed: 0, error: 'unscrapeable' };

  const now = new Date().toISOString();
  const rows = new Map<string, Record<string, unknown>>();
  for (const p of scrape.products) {
    if (isExcludedProduct(p.name)) continue;
    const id = `${slugify(brand.name)}-${slugify(p.handle)}`;
    rows.set(id, { // Map, not array — a duplicate id within one upsert statement is a hard Postgres error
      id, brand_id: brand.id, brand: brand.name, name: p.name, price: p.price, prices: p.prices,
      image: p.image, images: p.images ?? [], ratio: p.ratio, url: p.url, description: p.description,
      category: classifyCategory(p.name, brand.matched_categories?.[0] ?? null),
      source: 'auto_scrape', status: 'active', removed_at: null, last_seen_at: now,
    });
  }
  const all = [...rows.values()];
  for (let i = 0; i < all.length; i += PRODUCT_UPSERT_CHUNK) {
    const { error } = await admin.from('products').upsert(all.slice(i, i + PRODUCT_UPSERT_CHUNK), { onConflict: 'id' });
    // Stop before the removal step — a half-written catalog must never be
    // read as "everything else is gone".
    if (error) return { count: i, removed: 0, error: error.message };
  }

  // Only a complete read of the store can say what's gone: sold out, or
  // taken down. Products never used to be removed at all, so sold-out
  // pieces stayed in the feed indefinitely.
  let removed = 0;
  if (scrape.complete) {
    const { count } = await admin.from('products')
      .update({ status: 'removed', removed_at: now }, { count: 'exact' })
      .eq('brand_id', brand.id).eq('status', 'active').lt('last_seen_at', runStart);
    removed = count ?? 0;
  }

  await admin.from('brands').update({
    platform: scrape.platform,
    feed_domain: scrape.feedDomain,
    currency: scrape.currency,
    has_usd_pricing: scrape.hasUsdPricing,
    scrape_cursor: scrape.nextCursor,
  }).eq('id', brand.id);

  return { count: all.length, removed, currency: scrape.currency, usd_pricing: scrape.hasUsdPricing };
}

function passesPreFilter(domain: string, products: ScrapedProduct[]): boolean {
  const blockedPatterns = ['amazon.', 'aliexpress.', 'temu.', 'wish.com'];
  if (blockedPatterns.some(p => domain.includes(p))) return false;
  if (domain.includes('.myshopify.com')) return false; // no custom domain — not a real indie brand site
  if (products.length > 500) return false; // dropshipper-scale catalog
  return true;
}

async function judgeBrand(anthropicKey: string, domain: string, products: ScrapedProduct[]) {
  const sample = products.slice(0, 8).map(p => `${p.name} — $${p.price}${p.description ? ' — ' + p.description.slice(0, 120) : ''}`).join('\n');
  const prompt = `${RUBRIC}

Brand domain: ${domain}
Sample products from this brand:
${sample}

Respond with ONLY a JSON object, no other text:
{"brand_name": "<the brand's actual display name, properly spaced and capitalized — infer it from the domain and product copy, e.g. 'leftfieldnyc.com' -> 'Left Field NYC', not a literal transcription of the domain>", "verdict": "approve"|"reject"|"uncertain", "confidence": <0-100>, "matched_categories": [...], "matched_styles": [...], "audience": "mens"|"womens"|"unisex", "reasoning": "<one or two sentences>"}`;

  const res = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data.content?.[0]?.text ?? '{}';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  return JSON.parse(jsonMatch ? jsonMatch[0] : '{}');
}

// Semantic embeddings for products (brand + name + description) — lets
// ranking compare products by what they actually are, not just shared
// category/style tags. voyage-4-lite, 1024 dimensions — must match the
// `vector(1024)` column in migration 010 exactly, or inserts fail.
//
// Batched (one call covers up to ~20 products) rather than one call per
// product — Voyage's free tier rate limit is low enough that the original
// one-request-per-product version got ~98% rate-limited on its first real
// run (3 of 200 succeeded). Voyage's API accepts `input` as an array, so
// this is a real fix, not a band-aid delay — fewer requests outright,
// not just slower ones.
async function generateEmbeddings(voyageKey: string, texts: string[]): Promise<(number[] | null)[]> {
  try {
    const res = await fetchWithTimeout('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'Authorization': `Bearer ${voyageKey}` },
      body: JSON.stringify({ input: texts, model: 'voyage-4-lite', input_type: 'document' }),
    });
    if (!res.ok) return texts.map(() => null);
    const data = await res.json();
    const embeddings: (number[] | null)[] = texts.map(() => null);
    for (const item of data.data ?? []) {
      if (typeof item.index === 'number') embeddings[item.index] = item.embedding ?? null;
    }
    return embeddings;
  } catch {
    return texts.map(() => null);
  }
}

// Search keywords a shopper might actually type — distinct from category/
// style, and deliberately an LLM call rather than a keyword dictionary:
// product copy frequently never uses the obvious term at all (a swimwear
// brand's products described only by cut/seam details, never "swim"), so
// this needs to infer intent from brand + name + description, not match
// literal substrings.
//
// Batched like generateEmbeddings, for the same reason: one call per
// product meant a 250-product brand made 250 sequential Anthropic
// round-trips, which reliably ran past the Edge Function's execution
// time limit and got the run killed mid-brand — Jungmaven ended up with
// 7 of its 250 real products in the catalog before the kill. Chunked at
// 20 products per call keeps each prompt/response small enough to be
// reliable, while cutting a 250-product brand from 250 calls to ~13.
const SEARCH_KEYWORDS_BATCH_SIZE = 20;

async function generateSearchKeywordsBatch(
  anthropicKey: string,
  brand: string,
  items: { name: string; description?: string }[],
): Promise<string[][]> {
  const results: string[][] = items.map(() => []);

  for (let start = 0; start < items.length; start += SEARCH_KEYWORDS_BATCH_SIZE) {
    const chunk = items.slice(start, start + SEARCH_KEYWORDS_BATCH_SIZE);
    const list = chunk
      .map((p, i) => `${i}. ${p.name} — ${(p.description ?? '').slice(0, 160) || 'no description'}`)
      .join('\n');
    const prompt = `Brand: ${brand}

For each numbered product below, list 3-6 generic search terms a shopper
might type to find that product type — words for the item TYPE, not the
brand or styling details (e.g. for a bikini top: "swim", "swimwear",
"bikini"; for a chore coat: "jacket", "coat", "outerwear").

Products:
${list}

Respond with ONLY a JSON array of ${chunk.length} arrays of lowercase
strings, one per product in the same order as above, no other text.
Example shape: [["jacket","coat"],["shoe","sneaker"]]`;

    try {
      const res = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 120 * chunk.length, messages: [{ role: 'user', content: prompt }] }),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.content?.[0]?.text ?? '[]';
        const match = text.match(/\[[\s\S]*\]/);
        const parsed = match ? JSON.parse(match[0]) : [];
        chunk.forEach((_, i) => {
          if (Array.isArray(parsed[i])) results[start + i] = parsed[i];
        });
      }
    } catch {
      // Leave this chunk's entries as [] — a bad chunk shouldn't fail the whole brand.
    }
  }

  return results;
}

// Cheap per-product category classification — no extra LLM call. Falls back
// to the brand's own judge-assigned matched_categories[0] when no keyword
// hits, since a brand-level category is still far better than NULL (which
// silently excludes a product from every category filter in the app).
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  shoes:       ['shoe', 'sneaker', 'boot', 'sandal', 'loafer', 'slipper', 'heel', 'flat', 'moccasin', 'clog', 'espadrille'],
  bags:        ['bag', 'tote', 'backpack', 'pouch', 'wallet', 'clutch', 'satchel', 'duffel'],
  accessories: ['sunglass', 'eyewear', 'glasses', 'hat', 'cap', 'beanie', 'scarf', 'belt', 'jewelry', 'necklace', 'earring', 'bracelet', 'ring', 'watch', 'sock', 'tie'],
  home:        ['mug', 'candle', 'vase', 'pillow', 'blanket', 'throw', 'plate', 'bowl', 'rug', 'sheet', 'towel', 'ceramic', 'glassware', 'tray'],
  beauty:      ['serum', 'cream', 'lotion', 'fragrance', 'perfume', 'cologne', 'skincare', 'cleanser', 'lip', 'balm', 'oil', 'shampoo', 'soap'],
};

function classifyCategory(productName: string, fallback: string | null): string {
  const lower = productName.toLowerCase();
  for (const [category, words] of Object.entries(CATEGORY_KEYWORDS)) {
    if (words.some(w => lower.includes(w))) return category;
  }
  return fallback ?? 'clothing';
}

// Excludes two kinds of scraped "products" that aren't real catalog items:
// checkout add-ons that show up in products.json alongside real merchandise
// (shipping protection, warranties, gift wrap — found via Rikumo's "Free
// returns + package protection" at $1), and literal books, which don't fit
// a fashion/home/beauty catalog regardless of which brand happens to sell
// them (found via Tanner Goods and Orée New York both carrying books).
const EXCLUDED_PRODUCT_PATTERNS = [
  /package protection/i, /shipping protection/i, /extended warranty/i,
  /gift wrap/i, /\bdonation\b/i,
  /\bbook\b/i,
];

function isExcludedProduct(productName: string): boolean {
  return EXCLUDED_PRODUCT_PATTERNS.some(p => p.test(productName));
}

// Self-check action: { "action": "summary" } returns recent brand decisions
// (with Sam's actual status, not just the judge's verdict) so judging
// patterns can be reviewed and the RUBRIC corrected without needing a
// dashboard screenshot each time. Uses the service-role key internally, so
// this bypasses RLS the same way writes already do — it's reachable with
// just the anon key, same as the rest of this function.
async function getSummary(admin: ReturnType<typeof createClient>) {
  const { data } = await admin
    .from('brands')
    .select('name, domain, status, judge_confidence, judge_reasoning, matched_categories, matched_styles, created_at')
    .order('created_at', { ascending: false })
    .limit(100);
  const rows = data ?? [];

  // by_status above only reflects the most-recent-100 sample, which
  // undercounts once total brand rows exceed 100 (older pending/rejected
  // rows age out of the window even though they still exist). true_total
  // is a real count across the whole table, for tracking actual progress
  // during a long discovery run.
  const [approvedCount, rejectedCount, pendingCount] = await Promise.all([
    admin.from('brands').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
    admin.from('brands').select('*', { count: 'exact', head: true }).eq('status', 'rejected'),
    admin.from('brands').select('*', { count: 'exact', head: true }).eq('status', 'pending_review'),
  ]);

  return {
    total: rows.length,
    by_status: {
      approved: rows.filter(r => r.status === 'approved').length,
      rejected: rows.filter(r => r.status === 'rejected').length,
      pending_review: rows.filter(r => r.status === 'pending_review').length,
    },
    true_total: {
      approved: approvedCount.count ?? null,
      rejected: rejectedCount.count ?? null,
      pending_review: pendingCount.count ?? null,
    },
    rejected: rows.filter(r => r.status === 'rejected'),
    pending: rows.filter(r => r.status === 'pending_review'),
  };
}


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
function respond(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

// Server-side admin check for actions that write data (review_decision) or
// expose pre-review brand reasoning (list_pending) — brands.judge_reasoning
// for pending/rejected brands isn't public (RLS only exposes approved), so
// this can't be a client-side isAdmin check alone. Verifies the caller's own
// session JWT against their actual email, via Supabase Auth, not a
// client-supplied flag.
const ADMIN_EMAIL = 'samphoffer@gmail.com';
async function requireAdmin(req: Request, admin: ReturnType<typeof createClient>): Promise<{ id: string } | null> {
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!jwt) return null;
  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data.user || data.user.email !== ADMIN_EMAIL) return null;
  return { id: data.user.id };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return respond({}, 200);
  try {
    const body = await req.json();

    if (body.action === 'summary') {
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      return respond(await getSummary(admin));
    }

    // List brands awaiting review — used by the in-app review queue.
    if (body.action === 'list_pending') {
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      const caller = await requireAdmin(req, admin);
      if (!caller) return respond({ error: 'Unauthorized' }, 403);

      const { data, error } = await admin
        .from('brands')
        .select('id, name, domain, platform, judge_confidence, judge_reasoning, matched_categories, matched_styles, audience, created_at')
        .eq('status', 'pending_review')
        .order('created_at', { ascending: false });
      if (error) return respond({ error: error.message }, 500);
      return respond({ brands: data ?? [] });
    }

    // Approve or reject a pending brand from the review queue. The
    // status='pending_review' guard on the update means a double-tap or a
    // stale client list can't re-decide something already resolved.
    if (body.action === 'review_decision') {
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      const caller = await requireAdmin(req, admin);
      if (!caller) return respond({ error: 'Unauthorized' }, 403);

      const { brand_id, decision, note } = body;
      if (!brand_id || (decision !== 'approve' && decision !== 'reject')) {
        return respond({ error: 'Provide brand_id and decision ("approve"|"reject")' }, 400);
      }

      const status = decision === 'approve' ? 'approved' : 'rejected';
      const { data, error } = await admin
        .from('brands')
        .update({
          status,
          approved_by: decision === 'approve' ? caller.id : null,
          approved_at: decision === 'approve' ? new Date().toISOString() : null,
          // The real reason a human overrode the queue, distinct from
          // judge_reasoning (the AI's own reasoning at judgment time, which
          // for a queued/approve-verdict brand argues FOR it, not against).
          rejection_note: decision === 'reject' && note ? String(note).slice(0, 500) : null,
        })
        .eq('id', brand_id)
        .eq('status', 'pending_review')
        .select()
        .maybeSingle();
      if (error) return respond({ error: error.message }, 500);
      if (!data) return respond({ error: 'Brand was already decided or not found' }, 409);
      return respond({ ok: true, status });
    }

    // One-off cleanup action for brands named before the judge started
    // returning a proper brand_name: { "action": "rename", "renames": {
    // "domain.com": "Correct Name" } }. Not part of the normal intake flow.
    if (body.action === 'rename') {
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      const renames: Record<string, string> = body.renames ?? {};
      const results = [];
      for (const [domain, name] of Object.entries(renames)) {
        const { data: brand, error } = await admin.from('brands').update({ name }).eq('domain', domain).select().single();
        if (brand) {
          // products.brand is denormalized at scrape time, not a live join — has to be fixed separately.
          await admin.from('products').update({ brand: name }).eq('brand_id', brand.id);
        }
        results.push({ domain, name, ok: !error, error: error?.message });
      }
      return respond({ results }, 200);
    }

    // One-off backfill for products inserted before classifyCategory existed,
    // or whose row was never touched by a later refresh (each refresh only
    // re-fetches the brand's current top ~20 items, so older accumulated
    // rows outside that window keep whatever category they were inserted
    // with — including null, from before this function set one at all).
    if (body.action === 'backfill_categories') {
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      const { data: brands } = await admin.from('brands').select('id, matched_categories');
      const brandCategory = new Map<string, string | null>((brands ?? []).map((b: any) => [b.id, b.matched_categories?.[0] ?? null]));

      let updated = 0;
      let removed = 0;
      const pageSize = 500;
      // Each row processed below either gets a non-null category or gets
      // deleted, so it drops out of this same `is('category', null)` filter
      // on the next loop — re-querying range(0, pageSize-1) every time (no
      // incrementing offset) is what makes this converge instead of
      // skipping rows as the filtered set shrinks underneath an offset.
      while (true) {
        const { data: rows } = await admin
          .from('products').select('id, name, brand_id, category')
          .is('category', null)
          .range(0, pageSize - 1);
        if (!rows || rows.length === 0) break;
        for (const row of rows) {
          if (isExcludedProduct(row.name)) {
            await admin.from('products').delete().eq('id', row.id);
            removed++;
            continue;
          }
          const category = classifyCategory(row.name, brandCategory.get(row.brand_id as string) ?? null);
          await admin.from('products').update({ category }).eq('id', row.id);
          updated++;
        }
        if (rows.length < pageSize) break;
      }
      return respond({ updated, removed }, 200);
    }

    // One-off backfill: embeds every product that doesn't have one yet —
    // everything scraped before VOYAGE_API_KEY existed, or scraped while it
    // was temporarily unset. No re-scraping needed, just embeds the text
    // already stored on each row.
    if (body.action === 'backfill_embeddings') {
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      const voyageKey = Deno.env.get('VOYAGE_API_KEY');
      if (!voyageKey) {
        return respond({ error: 'VOYAGE_API_KEY secret not configured' }, 500);
      }
      let embedded = 0;
      let failed = 0;
      const pageSize = 200;
      const batchSize = 20;
      while (true) {
        const { data: rows } = await admin
          .from('products').select('id, brand, name, description')
          .is('embedding', null)
          .range(0, pageSize - 1);
        if (!rows || rows.length === 0) break;
        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize);
          const embeddings = await generateEmbeddings(voyageKey, batch.map(r => `${r.brand} ${r.name} ${r.description ?? ''}`.trim()));
          for (let j = 0; j < batch.length; j++) {
            const embedding = embeddings[j];
            if (embedding) {
              await admin.from('products').update({ embedding: JSON.stringify(embedding) }).eq('id', batch[j].id);
              embedded++;
            } else {
              failed++;
              // Stop retrying this exact row forever on a hard failure — mark it
              // attempted by giving it a zero vector isn't right either, so just
              // count it and move on; next backfill run will retry it naturally
              // since embedding is still null.
            }
          }
          await sleep(500); // pace between batched Voyage calls, not just between rows
        }
        if (rows.length < pageSize) break;
        if (failed > 40) break; // bail out if Voyage is broadly failing, not just one bad row
      }
      return respond({ embedded, failed }, 200);
    }

    // One-off backfill: classifies audience for every approved brand that
    // predates the audience field, using only what's already stored (name +
    // judge_reasoning + matched_categories/styles) — no re-scraping.
    if (body.action === 'backfill_audience') {
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      const anthropicKeyLocal = Deno.env.get('ANTHROPIC_API_KEY');
      if (!anthropicKeyLocal) {
        return respond({ error: 'ANTHROPIC_API_KEY secret not configured' }, 500);
      }
      const { data: brands } = await admin
        .from('brands').select('id, name, judge_reasoning, matched_categories, matched_styles')
        .eq('status', 'approved')
        .is('audience', null);

      let updated = 0;
      let failed = 0;
      for (const brand of brands ?? []) {
        const prompt = `Brand: ${brand.name}
Categories: ${(brand.matched_categories ?? []).join(', ')}
Styles: ${(brand.matched_styles ?? []).join(', ')}
Notes: ${brand.judge_reasoning ?? 'none'}

Based on this brand's name and product focus, classify its primary customer audience.
Respond with ONLY a JSON object, no other text: {"audience": "mens"|"womens"|"unisex"}`;
        try {
          const res = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-api-key': anthropicKeyLocal, 'anthropic-version': '2023-06-01' },
            body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 50, messages: [{ role: 'user', content: prompt }] }),
          });
          const data = await res.json();
          const text = data.content?.[0]?.text ?? '{}';
          const match = text.match(/\{[\s\S]*\}/);
          const audience = match ? JSON.parse(match[0]).audience : null;
          if (audience) {
            await admin.from('brands').update({ audience }).eq('id', brand.id);
            updated++;
          } else {
            failed++;
          }
        } catch {
          failed++;
        }
        await sleep(300);
      }
      return respond({ updated, failed }, 200);
    }

    // One-off backfill: generates search keywords for every product that
    // predates this field. No re-scraping — uses what's already stored.
    if (body.action === 'backfill_search_keywords') {
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      const anthropicKeyLocal = Deno.env.get('ANTHROPIC_API_KEY');
      if (!anthropicKeyLocal) {
        return respond({ error: 'ANTHROPIC_API_KEY secret not configured' }, 500);
      }
      let updated = 0;
      let failed = 0;
      const pageSize = 200;
      while (true) {
        const { data: rows } = await admin
          .from('products').select('id, brand, name, description')
          .eq('search_keywords', '{}')
          .range(0, pageSize - 1);
        if (!rows || rows.length === 0) break;

        // Group by brand — one batched call per brand in this page, not
        // one call per product (see generateSearchKeywordsBatch).
        const byBrand = new Map<string, typeof rows>();
        for (const row of rows) {
          byBrand.set(row.brand, [...(byBrand.get(row.brand) ?? []), row]);
        }

        for (const [brand, brandRows] of byBrand) {
          const keywordsList = await generateSearchKeywordsBatch(anthropicKeyLocal, brand, brandRows);
          for (let i = 0; i < brandRows.length; i++) {
            const keywords = keywordsList[i];
            if (keywords.length > 0) {
              await admin.from('products').update({ search_keywords: keywords }).eq('id', brandRows[i].id);
              updated++;
            } else {
              failed++;
            }
          }
        }
        if (rows.length < pageSize) break;
        if (failed > 30) break;
      }
      return respond({ updated, failed }, 200);
    }

    // Convenience action: re-scrape currently-approved brands.
    // Supports optional offset + limit for paginated batching from the
    // GitHub Actions workflow — calling this in one shot on a large catalog
    // hits Supabase's 150s idle timeout.
    // { "action": "refresh_all", "refresh_offset": 0, "refresh_limit": 5 }
    if (body.action === 'refresh_all') {
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      const offset = body.refresh_offset ?? 0;
      const limit  = body.refresh_limit  ?? 5;
      const { data: approved } = await admin.from('brands').select('domain').eq('status', 'approved')
        .order('created_at', { ascending: true })
        .range(offset, offset + limit - 1);
      body.domains = (approved ?? []).map((b: { domain: string }) => b.domain);
    }

    const { domains } = body;
    if (!Array.isArray(domains) || domains.length === 0) {
      return respond({ error: 'Provide a non-empty "domains" array' }, 400);
    }

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) {
      return respond({ error: 'ANTHROPIC_API_KEY secret not configured' }, 500);
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const fx = await getUsdRates(admin);
    const results: Record<string, unknown>[] = [];

    for (const domain of domains.slice(0, MAX_DOMAINS_PER_RUN)) {
      await sleep(REQUEST_DELAY_MS);

      // Skip brands already evaluated (respecting rejected_until cooldown).
      const { data: existing, error: lookupError } = await admin.from('brands').select('*').eq('domain', domain).maybeSingle();
      if (lookupError) {
        // Never treat a failed lookup as "brand not found" — that path re-judges
        // and overwrites via onConflict:'domain', which would silently revert an
        // already-approved/rejected brand back to pending_review on a transient blip.
        results.push({ domain, action: 'skipped_lookup_error', error: lookupError.message });
        continue;
      }
      if (existing) {
        if (existing.status === 'approved') {
          // Re-scrape products for an already-approved brand — no LLM call, no new review.
          results.push({ domain, action: 'refreshed_products', ...await refreshBrand(admin, existing, fx) });
          continue;
        }
        if (existing.status === 'rejected' && existing.rejected_until && new Date(existing.rejected_until) > new Date()) {
          results.push({ domain, action: 'skipped_cooldown' });
          continue;
        }
        if (existing.status === 'pending_review') {
          if (!body.auto_approve) {
            results.push({ domain, action: 'skipped_already_pending' });
            continue;
          }
          // Hand-picked path: promote straight to approved and scrape products now.
          const { error: promoteError } = await admin.from('brands').update({ status: 'approved', hand_picked: true }).eq('id', existing.id);
          if (promoteError) {
            results.push({ domain, action: 'db_error_promote', error: promoteError.message });
            continue;
          }
          results.push({ domain, action: 'auto_approved', ...await refreshBrand(admin, existing, fx) });
          continue;
        }
      }

      if (await isDisallowed(domain)) {
        results.push({ domain, action: 'skipped_robots_disallowed' });
        continue;
      }

      // Judging only needs a sample, so a single page here — the full
      // catalog is scraped by refreshBrand below once a brand is approved.
      const sample = await probeShopify(domain, fx, { maxPages: 1 }) ?? await probeLdJson(domain, fx, { maxPages: 12 });
      if (!sample) {
        results.push({ domain, action: 'skipped_unscrapeable' });
        continue;
      }
      if (!passesPreFilter(domain, sample.products)) {
        results.push({ domain, action: 'rejected_pre_filter' });
        continue;
      }

      const judgment = await judgeBrand(anthropicKey, domain, sample.products);
      const brandName = judgment.brand_name || domain.replace(/\.(com|co|net|store)$/, '').replace(/[-_]/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());

      // The judge's verdict used to be computed and thrown away — every brand
      // landed in pending_review regardless of whether the judge said approve,
      // reject, or uncertain, so a confident reject (e.g. an explicit
      // boho-chic or over-ceiling-luxury match) sat in the same queue as a
      // genuine approve call, forcing a manual re-decision of something
      // already decided. Only high-confidence rejects skip review — approve
      // and uncertain verdicts still go to pending_review as before.
      const REJECT_AUTO_CONFIDENCE = 70;
      const finalStatus = body.auto_approve
        ? 'approved'
        : judgment.verdict === 'reject' && (judgment.confidence ?? 0) >= REJECT_AUTO_CONFIDENCE
          ? 'rejected'
          : 'pending_review';
      const { data: brandRow, error: upsertError } = await admin.from('brands').upsert({
        name: brandName,
        domain,
        status: finalStatus,
        platform: sample.platform,
        feed_domain: sample.feedDomain,
        currency: sample.currency,
        has_usd_pricing: sample.hasUsdPricing,
        judge_confidence: judgment.confidence ?? null,
        judge_reasoning: judgment.reasoning ?? null,
        matched_categories: judgment.matched_categories ?? [],
        matched_styles: judgment.matched_styles ?? [],
        audience: judgment.audience ?? null,
        hand_picked: !!body.auto_approve,
      }, { onConflict: 'domain' }).select().single();

      if (upsertError) {
        results.push({ domain, action: 'db_error_upsert', error: upsertError.message });
        continue;
      }

      if (body.auto_approve && brandRow) {
        results.push({ domain, action: 'auto_approved', verdict: judgment.verdict, confidence: judgment.confidence, brand_id: brandRow.id, ...await refreshBrand(admin, brandRow, fx) });
      } else {
        const action = finalStatus === 'rejected' ? 'auto_rejected' : 'queued_for_review';
        results.push({ domain, action, verdict: judgment.verdict, confidence: judgment.confidence, brand_id: brandRow?.id });
      }
    }

    return respond({ results }, 200);
  } catch (err) {
    return respond({ error: String(err) }, 500);
  }
});
