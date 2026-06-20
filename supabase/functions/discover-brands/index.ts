import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Finds new candidate brand domains via Exa's structured search — the "what
// should we even try" step catalog-intake doesn't do itself (it only
// processes whatever domains it's handed). Deliberately does NOT chain into
// catalog-intake automatically: Exa calls are fast, catalog-intake's
// scrape+judge loop is slow (already hit Supabase's ~150s platform idle
// timeout once with large batches), and stacking both in one request risks
// the same failure mode. Call this, see what it found, then POST the
// `candidates` domains to catalog-intake separately.
//
// Every candidate is checked against the `brands` table and dropped if
// already known — catalog-intake's own dedup is for domains within ONE
// call; this is for not re-discovering the same brand across runs.

const DEFAULT_QUERIES = [
  'independent DTC heritage workwear brand small batch',
  'independent quiet minimalist eyewear brand',
  'independent handmade leather footwear brand craft',
  'independent coastal lifestyle clothing brand small DTC',
  'independent cottagecore home decor brand small batch',
  'independent boho vintage womenswear brand small label',
  'independent maximalist colorful print clothing brand',
  'independent clean beauty skincare brand young effortless',
  'independent artisan ceramics tableware brand small studio',
  'independent industrial design home decor brand small label',
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
      systemPrompt: "Return only actual brand storefront homepages (the brand's own site where they sell their products directly) — never marketplaces, department stores, retailers, listicle/roundup articles, or social media profiles. Extract the brand's real display name and bare domain (no https://, no www, no path).",
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
