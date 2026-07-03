import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Finds new candidate brand domains via Exa's structured search — the "what
// should we even try" step catalog-intake doesn't do itself (it only
// processes whatever domains it's handed). Deliberately does NOT chain into
// catalog-intake automatically: Exa calls are fast, catalog-intake's
// scrape+judge loop is slow, and stacking both in one request risks the same
// WORKER_RESOURCE_LIMIT failure mode. Call this, see what it found, then POST
// the `candidates` domains to catalog-intake separately.
//
// Every candidate is checked against the `brands` table and dropped if
// already known — catalog-intake's own dedup is for domains within ONE
// call; this is for not re-discovering the same brand across runs.
//
// QUERY PHILOSOPHY (updated after early results pulled too many cheap/boho brands):
// Queries must describe the TARGET CUSTOMER's aesthetic and quality register,
// not just the brand's style category. "Bohemian womenswear" pulls in $25
// Etsy-tier brands. "Elevated considered womenswear premium DTC" pulls in
// the kind of brand that earns a place in someone's rotation for 10 years.
// Queries prioritize: heritage story, craft/material obsession, quality DTC,
// premium price point, clear brand identity. NOT: trend-chasing, fast fashion,
// festival wear, or anything that reads as "marketplace brand."

const DEFAULT_QUERIES = [
  // Footwear — proven high-performer category (Bass, Birkenstock, Morjas, RONNING, Havaianas all fit)
  'premium independent leather footwear brand craft heritage quality',
  'independent elevated sneaker brand minimalist premium DTC',
  'independent heritage American boot brand quality craftsmanship',
  'independent premium sandal footwear brand quality materials',

  // Menswear — heritage, craft, elevated basics
  'independent heritage workwear brand quality materials American made',
  'independent elevated basics menswear brand capsule wardrobe premium',
  'independent considered minimalist menswear brand quality DTC',

  // Womenswear — elevated, considered, NOT bohemian
  'independent elevated womenswear brand quality materials premium DTC',
  'independent considered minimalist womenswear brand timeless classic',
  'independent premium resort wear brand quality craftsmanship story',

  // Accessories & leather goods
  'independent premium leather bag brand craft heritage quality',
  'independent elevated accessories brand quality materials DTC',

  // Home — premium, considered, not mass-market
  'independent premium home goods brand craft minimal quality design',

  // Beauty — young, effortless, NOT clinical or anti-aging
  'independent clean beauty brand young urban effortless quality ingredients',
];

interface ExaBrand {
  name?: string;
  domain?: string;
}

async function searchExa(apiKey: string, query: string): Promise<ExaBrand[]> {
  const res = await fetch('https://api.exa.ai/search', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey },
    body: JSON.stringify({
      query: `${query} official online store`,
      type: 'auto',
      numResults: 8,
      systemPrompt: "Return only actual brand storefronts (the brand's own site where they sell their products directly) — never marketplaces, department stores, multi-brand retailers, listicle/roundup articles, or social media profiles. The brand must be an independent direct-to-consumer brand with a clear identity and quality positioning. Extract the brand's real display name and bare domain (no https://, no www, no path).",
      outputSchema: {
        type: 'object',
        required: ['brands'],
        properties: {
          brands: {
            type: 'array',
            description: "Independent brand storefronts found, each the brand's own direct-to-consumer site",
            items: {
              type: 'object',
              required: ['name', 'domain'],
              properties: {
                name: { type: 'string', description: 'Brand display name' },
                domain: { type: 'string', description: 'Bare domain, e.g. example.com' },
              },
            },
          },
        },
      },
      contents: { highlights: true },
    }),
  });
  if (!res.ok) throw new Error(`Exa API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.output?.content?.brands ?? [];
}

function cleanDomain(raw: string): string {
  return raw.toLowerCase().trim()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '');
}

Deno.serve(async (req) => {
  try {
    const exaKey = Deno.env.get('EXA_API_KEY');
    if (!exaKey) {
      return new Response(JSON.stringify({ error: 'EXA_API_KEY secret not configured' }), { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const queries: string[] = Array.isArray(body.queries) && body.queries.length ? body.queries : DEFAULT_QUERIES;

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: known } = await admin.from('brands').select('domain');
    const knownDomains = new Set((known ?? []).map(b => b.domain));

    const seen = new Set<string>();
    const candidates: { name: string; domain: string }[] = [];
    const errors: { query: string; error: string }[] = [];

    for (const query of queries) {
      try {
        const brands = await searchExa(exaKey, query);
        for (const b of brands) {
          if (!b.domain || !b.name) continue;
          const domain = cleanDomain(b.domain);
          if (!domain || seen.has(domain) || knownDomains.has(domain)) continue;
          seen.add(domain);
          candidates.push({ name: b.name, domain });
        }
      } catch (err) {
        errors.push({ query, error: String(err) });
      }
    }

    return new Response(JSON.stringify({ queried: queries.length, found_new: candidates.length, candidates, errors }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
