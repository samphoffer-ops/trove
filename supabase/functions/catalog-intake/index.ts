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
  price: number;
  image: string;
  images?: string[];
  ratio: number;
  url: string;
  description?: string;
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

async function probeShopify(domain: string): Promise<ScrapedProduct[] | null> {
  try {
    const res = await fetchWithTimeout(`https://${domain}/products.json?limit=250`, { headers: { 'User-Agent': 'TroveCatalogBot/1.0' } });
    if (!res.ok) return null;
    const data = await res.json();
    const products = data.products;
    if (!Array.isArray(products) || products.length === 0) return null;
    return products.map((p: any) => {
      const img = p.images?.[0];
      const ratio = img?.width && img?.height ? img.height / img.width : 1.25;
      const allImages: string[] = (p.images ?? []).map((i: any) => i?.src).filter(Boolean);
      return {
        handle: p.handle,
        name: p.title,
        price: parseFloat(p.variants?.[0]?.price ?? '0'),
        image: img?.src ?? '',
        images: allImages.length > 1 ? allImages : undefined,
        ratio,
        url: `https://${domain}/products/${p.handle}`,
        description: (p.body_html ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300),
      };
    }).filter((p: ScrapedProduct) => p.image && p.price > 0);
  } catch {
    return null;
  }
}

async function probeLdJson(domain: string): Promise<ScrapedProduct[] | null> {
  try {
    const sitemapRes = await fetchWithTimeout(`https://${domain}/sitemap.xml`, { headers: { 'User-Agent': 'TroveCatalogBot/1.0' } });
    if (!sitemapRes.ok) return null;
    const sitemapText = await sitemapRes.text();
    const productSitemapMatch = sitemapText.match(/<loc>([^<]*product[^<]*sitemap[^<]*)<\/loc>/i);
    if (!productSitemapMatch) return null;
    await sleep(500);
    const productSitemapRes = await fetchWithTimeout(productSitemapMatch[1], { headers: { 'User-Agent': 'TroveCatalogBot/1.0' } });
    if (!productSitemapRes.ok) return null;
    const productUrls = [...(await productSitemapRes.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]).slice(0, 60);

    const products: ScrapedProduct[] = [];
    for (const url of productUrls) {
      await sleep(REQUEST_DELAY_MS);
      try {
        const pageRes = await fetchWithTimeout(url, { headers: { 'User-Agent': 'TroveCatalogBot/1.0' } });
        if (!pageRes.ok) continue;
        const html = await pageRes.text();
        const ldMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
        if (!ldMatch) continue;
        const ld = JSON.parse(ldMatch[1]);
        if (ld['@type'] !== 'Product') continue;
        const image = Array.isArray(ld.image) ? ld.image[0]?.contentUrl ?? ld.image[0] : ld.image?.contentUrl ?? ld.image;
        const price = parseFloat(ld.Offers?.price ?? ld.offers?.price ?? '0');
        if (!image || !price) continue;
        products.push({
          handle: slugify(ld.name ?? url),
          name: ld.name,
          price,
          image,
          ratio: 1.0,
          url,
          description: (ld.description ?? '').slice(0, 300),
        });
      } catch { /* skip this one product, keep going */ }
    }
    return products.length > 0 ? products : null;
  } catch {
    return null;
  }
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
async function generateSearchKeywords(anthropicKey: string, brand: string, name: string, description: string): Promise<string[]> {
  const prompt = `Brand: ${brand}
Product: ${name}
Description: ${description.slice(0, 200) || 'none'}

List 3-6 generic search terms a shopper might type to find this product — the
kind of words for the item TYPE, not the brand or styling details (e.g. for a
bikini top: "swim", "swimwear", "bikini"; for a chore coat: "jacket", "coat",
"outerwear"). Respond with ONLY a JSON array of lowercase strings, no other text.`;
  try {
    const res = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 100, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const text = data.content?.[0]?.text ?? '[]';
    const match = text.match(/\[[\s\S]*\]/);
    return match ? JSON.parse(match[0]) : [];
  } catch {
    return [];
  }
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
  return {
    total: rows.length,
    by_status: {
      approved: rows.filter(r => r.status === 'approved').length,
      rejected: rows.filter(r => r.status === 'rejected').length,
      pending_review: rows.filter(r => r.status === 'pending_review').length,
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return respond({}, 200);
  try {
    const body = await req.json();

    if (body.action === 'summary') {
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      return respond(await getSummary(admin));
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
        for (const row of rows) {
          const keywords = await generateSearchKeywords(anthropicKeyLocal, row.brand, row.name, row.description ?? '');
          if (keywords.length > 0) {
            await admin.from('products').update({ search_keywords: keywords }).eq('id', row.id);
            updated++;
          } else {
            failed++;
          }
        }
        if (rows.length < pageSize) break;
        if (failed > 30) break;
      }
      return respond({ updated, failed }, 200);
    }

    // Convenience action: re-scrape all currently-approved brands without
    // having to look up their domains first. { "action": "refresh_all" }
    if (body.action === 'refresh_all') {
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      const { data: approved } = await admin.from('brands').select('domain').eq('status', 'approved');
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
    // Embeddings degrade gracefully, not a hard requirement — if VOYAGE_API_KEY
    // isn't set yet, products still scrape/refresh fine, just without a vector
    // (ranking's cold-start path already handles "no embedding" correctly).
    const voyageKey = Deno.env.get('VOYAGE_API_KEY');

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
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
          const rawProducts = existing.platform === 'shopify' ? await probeShopify(domain) : await probeLdJson(domain);
          const products = (rawProducts ?? []).filter(p => !isExcludedProduct(p.name));
          if (products.length > 0) {
            // One batched Voyage call for the whole brand's products, not one
            // call per product — see generateEmbeddings' comment for why.
            const embeddings = voyageKey
              ? await generateEmbeddings(voyageKey, products.map(p => `${existing.name} ${p.name} ${p.description ?? ''}`.trim()))
              : products.map(() => null);
            for (let i = 0; i < products.length; i++) {
              const p = products[i];
              const id = `${slugify(existing.name)}-${slugify(p.handle)}`;
              const embedding = embeddings[i];
              const searchKeywords = await generateSearchKeywords(anthropicKey, existing.name, p.name, p.description ?? '');
              await admin.from('products').upsert({
                id, brand_id: existing.id, brand: existing.name, name: p.name, price: p.price,
                image: p.image, images: p.images ?? [], ratio: p.ratio, url: p.url, description: p.description,
                category: classifyCategory(p.name, existing.matched_categories?.[0] ?? null),
                search_keywords: searchKeywords,
                ...(embedding ? { embedding: JSON.stringify(embedding) } : {}),
                source: 'auto_scrape', status: 'active', last_seen_at: new Date().toISOString(),
              });
            }
          }
          results.push({ domain, action: 'refreshed_products', count: products.length });
          continue;
        }
        if (existing.status === 'rejected' && existing.rejected_until && new Date(existing.rejected_until) > new Date()) {
          results.push({ domain, action: 'skipped_cooldown' });
          continue;
        }
        if (existing.status === 'pending_review') {
          results.push({ domain, action: 'skipped_already_pending' });
          continue;
        }
      }

      if (await isDisallowed(domain)) {
        results.push({ domain, action: 'skipped_robots_disallowed' });
        continue;
      }

      const shopifyProducts = await probeShopify(domain);
      const products = shopifyProducts ?? await probeLdJson(domain);
      const platform = shopifyProducts ? 'shopify' : 'ld_json';

      if (!products || products.length === 0) {
        results.push({ domain, action: 'skipped_unscrapeable' });
        continue;
      }
      if (!passesPreFilter(domain, products)) {
        results.push({ domain, action: 'rejected_pre_filter' });
        continue;
      }

      const judgment = await judgeBrand(anthropicKey, domain, products);
      const brandName = judgment.brand_name || domain.replace(/\.(com|co|net|store)$/, '').replace(/[-_]/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());

      const { data: brandRow } = await admin.from('brands').upsert({
        name: brandName,
        domain,
        status: 'pending_review',
        platform,
        judge_confidence: judgment.confidence ?? null,
        judge_reasoning: judgment.reasoning ?? null,
        matched_categories: judgment.matched_categories ?? [],
        matched_styles: judgment.matched_styles ?? [],
        audience: judgment.audience ?? null,
      }, { onConflict: 'domain' }).select().single();

      results.push({ domain, action: 'queued_for_review', verdict: judgment.verdict, confidence: judgment.confidence, brand_id: brandRow?.id });
    }

    return respond({ results }, 200);
  } catch (err) {
    return respond({ error: String(err) }, 500);
  }
});
