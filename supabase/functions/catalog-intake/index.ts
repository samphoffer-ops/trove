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

const RUBRIC = `Trove is a curated shopping discovery app for adults in their 20s-30s. A brand
fits Trove's bar if it is: curated, intentional, authentic, effortless — a
quality DTC/independent brand, explicitly NOT Amazon-style mass-market or a
dropshipper, fits one or more of [fashion, home, beauty], fits one or more of
these styles: [minimalist, maximalist, streetwear, vintage, coastal,
cottagecore, industrial, boho].

Reject any brand whose catalog is primarily children's/kids' clothing or baby
products, even if the brand also makes adult items — Trove is not a kids'
shopping app.

Reject golf apparel / golf-lifestyle brands as a category — even when framed
as "streetwear" or "lifestyle," this has been confirmed an explicit miss for
Trove's taste, not a style worth surfacing more of. A brand that merely has a
founder or cultural tie to golf is fine; a brand whose core identity and
catalog IS golf apparel is not.

Reject brands that read as mainstream/mass-retail home goods (the kind of
brand you'd recognize from a big-box store aisle), even if the product
photography or copy uses "playful," "design-forward," or similar language —
prioritize genuinely small/independent over recognizable mass retail.

Reject unfocused "general store" brands selling across many unrelated
categories (e.g. stationery + wallets + kids' clothes in one catalog) with no
single coherent point of view — Trove brands should have a clear identity,
not be a curated multi-brand marketplace themselves.

Be skeptical of brands whose catalog is narrowly tied to a single occasion or
life event (e.g. wedding-specific decor) rather than everyday/ongoing use —
lean toward rejecting unless the craft/quality bar is exceptional.`;

const MAX_DOMAINS_PER_RUN = 15;
const REQUEST_DELAY_MS = 1500;

interface ScrapedProduct {
  handle: string;
  name: string;
  price: number;
  image: string;
  ratio: number;
  url: string;
  description?: string;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

async function isDisallowed(domain: string): Promise<boolean> {
  try {
    const res = await fetch(`https://${domain}/robots.txt`, { headers: { 'User-Agent': 'TroveCatalogBot/1.0' } });
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
    const res = await fetch(`https://${domain}/products.json?limit=20`, { headers: { 'User-Agent': 'TroveCatalogBot/1.0' } });
    if (!res.ok) return null;
    const data = await res.json();
    const products = data.products;
    if (!Array.isArray(products) || products.length === 0) return null;
    return products.map((p: any) => {
      const img = p.images?.[0];
      const ratio = img?.width && img?.height ? img.height / img.width : 1.25;
      return {
        handle: p.handle,
        name: p.title,
        price: parseFloat(p.variants?.[0]?.price ?? '0'),
        image: img?.src ?? '',
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
    const sitemapRes = await fetch(`https://${domain}/sitemap.xml`, { headers: { 'User-Agent': 'TroveCatalogBot/1.0' } });
    if (!sitemapRes.ok) return null;
    const sitemapText = await sitemapRes.text();
    const productSitemapMatch = sitemapText.match(/<loc>([^<]*product[^<]*sitemap[^<]*)<\/loc>/i);
    if (!productSitemapMatch) return null;
    await sleep(500);
    const productSitemapRes = await fetch(productSitemapMatch[1], { headers: { 'User-Agent': 'TroveCatalogBot/1.0' } });
    if (!productSitemapRes.ok) return null;
    const productUrls = [...(await productSitemapRes.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]).slice(0, 10);

    const products: ScrapedProduct[] = [];
    for (const url of productUrls) {
      await sleep(REQUEST_DELAY_MS);
      try {
        const pageRes = await fetch(url, { headers: { 'User-Agent': 'TroveCatalogBot/1.0' } });
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
{"verdict": "approve"|"reject"|"uncertain", "confidence": <0-100>, "matched_categories": [...], "matched_styles": [...], "reasoning": "<one or two sentences>"}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
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

Deno.serve(async (req) => {
  try {
    const body = await req.json();

    if (body.action === 'summary') {
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      return new Response(JSON.stringify(await getSummary(admin)), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    const { domains } = body;
    if (!Array.isArray(domains) || domains.length === 0) {
      return new Response(JSON.stringify({ error: 'Provide a non-empty "domains" array' }), { status: 400 });
    }

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY secret not configured' }), { status: 500 });
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const results: Record<string, unknown>[] = [];

    for (const domain of domains.slice(0, MAX_DOMAINS_PER_RUN)) {
      await sleep(REQUEST_DELAY_MS);

      // Skip brands already evaluated (respecting rejected_until cooldown).
      const { data: existing } = await admin.from('brands').select('*').eq('domain', domain).maybeSingle();
      if (existing) {
        if (existing.status === 'approved') {
          // Re-scrape products for an already-approved brand — no LLM call, no new review.
          const products = existing.platform === 'shopify' ? await probeShopify(domain) : await probeLdJson(domain);
          if (products) {
            for (const p of products) {
              const id = `${slugify(existing.name)}-${slugify(p.handle)}`;
              await admin.from('products').upsert({
                id, brand_id: existing.id, brand: existing.name, name: p.name, price: p.price,
                image: p.image, ratio: p.ratio, url: p.url, description: p.description,
                source: 'auto_scrape', status: 'active', last_seen_at: new Date().toISOString(),
              });
            }
          }
          results.push({ domain, action: 'refreshed_products', count: products?.length ?? 0 });
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
      const brandName = domain.replace(/\.(com|co|net|store)$/, '').replace(/[-_]/g, ' ')
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
      }, { onConflict: 'domain' }).select().single();

      results.push({ domain, action: 'queued_for_review', verdict: judgment.verdict, confidence: judgment.confidence, brand_id: brandRow?.id });
    }

    return new Response(JSON.stringify({ results }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
