import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// THREE-LAYER BRAND DISCOVERY
//
// Layer 1 — Seed-based: pull approved brands from the DB and use them as taste
// signals. Tells Exa "find me brands like these" — anchors on real curatorial
// decisions rather than abstract keyword guesses. Automatically improves as
// the catalog grows.
//
// Layer 2 — Editorial: search Highsnobiety, Monocle, GQ, Hypebeast, and similar
// publications for brand mentions in their "best of" / discovery content. These
// publications do curatorial work aligned with Trove's taste — surfacing brands
// they've featured is much stronger signal than keyword queries.
//
// Layer 3 — Keyword fallback: category-specific quality-first queries, focused
// on craft/heritage/premium positioning. Runs last so it fills gaps the first
// two layers miss, not as primary signal.
//
// Rejected brands from the DB are passed as anti-examples into every Exa prompt
// so the model learns from what Sam has already turned down.

const FETCH_TIMEOUT_MS = 12000;
function fetchWithTimeout(url: string, init: RequestInit = {}) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
}

interface Candidate {
  name: string;
  domain: string;
  source: 'seed' | 'editorial' | 'keyword' | 'nuuly';
}

function cleanDomain(raw: string): string {
  return (raw ?? '').toLowerCase().trim()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '');
}

// ─── LAYER 1: SEED-BASED ────────────────────────────────────────────────────

async function discoverFromSeeds(
  exaKey: string,
  approved: { name: string; domain: string }[],
  rejectedNames: string[],
  knownDomains: Set<string>,
): Promise<Candidate[]> {
  if (approved.length === 0) return [];

  // Shuffle so different clusters surface each weekly run
  const shuffled = [...approved].sort(() => Math.random() - 0.5);

  // Build clusters of 4–5 brands each, cap at 4 clusters to stay in budget
  const CLUSTER_SIZE = 4;
  const clusters: typeof approved[] = [];
  for (let i = 0; i < Math.min(shuffled.length, CLUSTER_SIZE * 4); i += CLUSTER_SIZE) {
    clusters.push(shuffled.slice(i, i + CLUSTER_SIZE));
  }

  const candidates: Candidate[] = [];
  for (const cluster of clusters) {
    const seedNames = cluster.map(b => b.name).join(', ');
    try {
      const found = await searchExaStorefronts(
        exaKey,
        `independent brand with the same cool, considered, craft-driven downtown aesthetic and customer as ${seedNames} — small team or founder story, strong visual identity, direct-to-consumer, not mall-owned or mass-distributed`,
        rejectedNames,
      );
      for (const b of found) {
        if (!knownDomains.has(b.domain)) candidates.push({ ...b, source: 'seed' });
      }
    } catch { /* skip failed cluster, continue */ }
  }
  return candidates;
}

// ─── LAYER 2: EDITORIAL ─────────────────────────────────────────────────────

// Publications that Trove's customer actually reads — editorial whose curatorial
// taste maps to "downtown, craft-driven, cool" rather than luxury or fast fashion.
const EDITORIAL_SEARCHES: { query: string; domains: string[] }[] = [
  {
    // The core discovery pipe: Highsnobiety and GQ's best-new-brand coverage
    // skews exactly toward the ALD/Bode/Noah NYC tier
    query: 'best new independent menswear brands to know 2024 2025 downtown cool craft',
    domains: ['highsnobiety.com', 'gq.com', 'esquire.com'],
  },
  {
    // Hypebeast covers the streetwear/prep-adjacent persona (ALD, Rowing Blazers,
    // Cherry LA tier) without drifting into pure hype/resale culture
    query: 'best independent streetwear brands quality craft considered cool 2024 2025',
    domains: ['hypebeast.com', 'highsnobiety.com'],
  },
  {
    // Women's side of the same customer — Sporty & Rich, Dôen, Alex Crane tier
    query: 'best independent womenswear brands downtown elevated cool off-duty considered',
    domains: ['whowhatwear.com', 'gq.com', 'highsnobiety.com'],
  },
  {
    // Craft/heritage rabbit hole — 3sixteen, Imogene & Willie, Taylor Stitch tier
    query: 'best craft heritage workwear denim brands independent small batch quality story',
    domains: ['gq.com', 'esquire.com', 'highsnobiety.com'],
  },
  {
    // Wallpaper and Monocle surface design-obsessed brands with a visual POV —
    // Toogood, Story Mfg., Kapital-adjacent
    query: 'best independent fashion design brands considered craft point of view editorial',
    domains: ['wallpaper.com', 'monocle.com', 'kinfolk.com'],
  },
  {
    // Cool Hunting and similar surfaces the culturally-active, drop-driven
    // independent label scene before it hits mainstream coverage
    query: 'cool new independent brand drop limited release quality lifestyle 2024 2025',
    domains: ['coolhunting.com', 'hypebeast.com', 'highsnobiety.com'],
  },
];

async function discoverFromEditorial(
  exaKey: string,
  anthropicKey: string,
  knownDomains: Set<string>,
  rejectedNames: string[],
): Promise<Candidate[]> {
  const candidates: Candidate[] = [];

  for (const { query, domains } of EDITORIAL_SEARCHES) {
    try {
      // Get article content from editorial publications
      const res = await fetchWithTimeout('https://api.exa.ai/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': exaKey },
        body: JSON.stringify({
          query,
          type: 'neural',
          numResults: 5,
          includeDomains: domains,
          contents: { text: { maxCharacters: 3000 } },
        }),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const articles = (data.results ?? []) as { url: string; text?: string }[];
      if (!articles.length) continue;

      const combinedText = articles
        .map(a => `SOURCE: ${a.url}\n${a.text ?? ''}`)
        .join('\n\n---\n\n')
        .slice(0, 8000);

      if (!combinedText.trim()) continue;

      // Use Claude Haiku to extract brand names + domains from editorial content
      const antiExamples = rejectedNames.length > 0
        ? `\n\nDo NOT include brands similar to these already-rejected examples: ${rejectedNames.slice(0, 12).join(', ')}.`
        : '';

      const extractRes = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 800,
          messages: [{
            role: 'user',
            content: `Extract independent fashion/lifestyle brand names and their most likely website domains from this editorial content. Only include actual brands (not publications, department stores, or multi-brand retailers). For each brand, predict the most likely bare domain (usually brandname.com or brand-name.com).${antiExamples}

Content:
${combinedText}

Respond ONLY with a JSON array — no other text:
[{"name": "Brand Name", "domain": "brandname.com"}, ...]

If no qualifying brands found, respond with [].`,
          }],
        }),
      });

      if (!extractRes.ok) continue;
      const extractData = await extractRes.json();
      const text = extractData.content?.[0]?.text ?? '[]';
      const match = text.match(/\[[\s\S]*\]/);
      if (!match) continue;

      const extracted: { name: string; domain: string }[] = JSON.parse(match[0]);
      for (const b of extracted) {
        const domain = cleanDomain(b.domain);
        if (domain && b.name && !knownDomains.has(domain)) {
          candidates.push({ name: b.name, domain, source: 'editorial' });
        }
      }
    } catch { /* skip failed editorial query */ }
  }

  return candidates;
}

// ─── LAYER 3: KEYWORD FALLBACK ──────────────────────────────────────────────

// Queries are written to surface the specific brand archetypes in the brief.
// Language mirrors how Trove's customer would talk about what they're looking
// for — not generic "quality premium" but specific cultural signals.
const KEYWORD_QUERIES = [
  // Downtown/design-forward menswear — Bode, Story Mfg., Corridor tier
  'independent menswear brand craft narrative small batch downtown NYC considered',
  // Streetwear/prep-adjacent — ALD, Noah NYC, Rowing Blazers tier
  'independent brand NYC prep streetwear quality collab downtown cool DTC',
  // Selvedge/heritage denim — 3sixteen, Imogene & Willie, Taylor Stitch tier
  'independent denim workwear brand Japanese selvedge heritage craft obsessive',
  // Graphic/art-adjacent — Online Ceramics, Cherry LA tier
  'independent graphic brand skate art-world cool irreverent quality DTC',
  // California coastal women's — Dôen, Alex Crane, Wellen tier
  'independent womenswear brand California coastal off-duty considered quality DTC',
  // Premium footwear with identity
  'independent footwear brand leather craft heritage quality point of view DTC',
  // Accessories/leather goods with craft story
  'independent leather goods bag brand craft heritage tannery quality small brand',
  // Drop-model / limited release labels
  'independent brand limited drop seasonal release point of view small team DTC',
  // European/international equivalent of the above
  'independent European menswear womenswear brand considered craft downtown quality',
  // Jewelry / fine accessories with identity
  'independent jewelry brand considered craft identity downtown cool DTC small studio',
  // Eyewear with a point of view
  'independent eyewear sunglasses brand craft identity considered cool DTC',
  // Hats / caps with brand identity — New Era-adjacent but independent
  'independent hat cap brand craft identity downtown cool limited DTC',
  // Bags and leather goods beyond basics
  'independent bag leather goods brand craft heritage considered identity DTC',
];

async function discoverFromKeywords(
  exaKey: string,
  rejectedNames: string[],
  knownDomains: Set<string>,
): Promise<Candidate[]> {
  const candidates: Candidate[] = [];
  for (const query of KEYWORD_QUERIES) {
    try {
      const found = await searchExaStorefronts(exaKey, query, rejectedNames);
      for (const b of found) {
        if (!knownDomains.has(b.domain)) candidates.push({ ...b, source: 'keyword' });
      }
    } catch { /* skip */ }
  }
  return candidates;
}

// ─── SHARED: EXA STOREFRONT SEARCH ──────────────────────────────────────────

async function searchExaStorefronts(
  apiKey: string,
  query: string,
  rejectedNames: string[],
): Promise<{ name: string; domain: string }[]> {
  const antiExamples = rejectedNames.length > 0
    ? ` Avoid recommending brands similar to these already-rejected examples: ${rejectedNames.slice(0, 12).join(', ')}.`
    : '';

  const res = await fetchWithTimeout('https://api.exa.ai/search', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey },
    body: JSON.stringify({
      query: `${query} official online store`,
      type: 'auto',
      numResults: 8,
      systemPrompt: `Return only actual brand storefronts (the brand's own site where they sell directly) — never marketplaces, department stores, multi-brand retailers, listicle articles, or social media profiles. The brand must be an independent DTC label with a clear identity and quality positioning.${antiExamples} Extract the brand's real display name and bare domain (no https://, no www, no path).`,
      outputSchema: {
        type: 'object',
        required: ['brands'],
        properties: {
          brands: {
            type: 'array',
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
    }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.output?.content?.brands ?? [])
    .map((b: { name?: string; domain?: string }) => ({
      name: b.name ?? '',
      domain: cleanDomain(b.domain ?? ''),
    }))
    .filter((b: { name: string; domain: string }) => b.name && b.domain);
}

// ─── LAYER 4: NUULY ─────────────────────────────────────────────────────────
//
// Nuuly (nuuly.com) carries hundreds of independent brands alongside the URBN
// family labels — it's one of the strongest external curation signals we have.
// We crawl their brands listing via Exa, extract brand slugs from URLs + page
// text, then use Claude to resolve each to a display name + likely DTC domain,
// filtering out Anthropologie/Free People/UO private labels in the same step.

async function discoverFromNuuly(
  exaKey: string,
  anthropicKey: string,
  knownDomains: Set<string>,
  rejectedNames: string[],
): Promise<Candidate[]> {
  try {
    const res = await fetchWithTimeout('https://api.exa.ai/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': exaKey },
      body: JSON.stringify({
        query: 'fashion brands available to rent clothing',
        type: 'keyword',
        numResults: 25,
        includeDomains: ['nuuly.com'],
        contents: { text: { maxCharacters: 4000 } },
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const results: { url?: string; text?: string }[] = data.results ?? [];

    // Pull brand slugs from URLs like /rent/brands/{slug}
    const brandSlugs = new Set<string>();
    for (const r of results) {
      const match = r.url?.match(/\/rent\/brands\/([^/?#]+)/);
      if (match) brandSlugs.add(match[1].replace(/-/g, ' '));
    }

    const combinedText = results.map(r => r.text ?? '').join('\n').slice(0, 5000);
    if (!combinedText.trim() && brandSlugs.size === 0) return [];

    const antiExamples = rejectedNames.length > 0
      ? `\n\nDo NOT include brands similar to these already-rejected examples: ${rejectedNames.slice(0, 10).join(', ')}.`
      : '';

    const extractRes = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1200,
        messages: [{
          role: 'user',
          content: `You are identifying independent fashion brands from Nuuly's rental catalog.

Brand slugs extracted from nuuly.com URLs: ${[...brandSlugs].join(', ') || 'see page text'}

Page text:
${combinedText}${antiExamples}

For each brand, provide their display name and most likely DTC website domain.

SKIP these — they are URBN private labels or sub-brands, not independent:
Anthropologie, Free People, Urban Outfitters, BHLDN, Maeve, Pilcro, Cloth & Stone,
Sanctuary, Floreat, Holding Horses, Eliza J, Moon River, BB Dakota.
Also skip any brand that is obviously mass-market, fast fashion, or not DTC.

Respond ONLY with a JSON array — no other text:
[{"name": "Brand Name", "domain": "brandname.com"}, ...]`,
        }],
      }),
    });

    if (!extractRes.ok) return [];
    const extractData = await extractRes.json();
    const text = extractData.content?.[0]?.text ?? '[]';
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];

    const extracted: { name: string; domain: string }[] = JSON.parse(match[0]);
    const candidates: Candidate[] = [];
    for (const b of extracted) {
      const domain = cleanDomain(b.domain);
      if (domain && b.name && !knownDomains.has(domain)) {
        candidates.push({ name: b.name, domain, source: 'nuuly' });
      }
    }
    return candidates;
  } catch {
    return [];
  }
}

// ─── MAIN ────────────────────────────────────────────────────────────────────


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
    const exaKey = Deno.env.get('EXA_API_KEY');
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!exaKey) {
      return respond({ error: 'EXA_API_KEY secret not configured' }, 500);
    }

    // Pull current brand state — all three queries in parallel
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const [{ data: allBrands }, { data: rejectedBrands }, { data: approvedBrands }] = await Promise.all([
      admin.from('brands').select('domain'),
      admin.from('brands').select('name').eq('status', 'rejected').order('created_at', { ascending: false }).limit(25),
      admin.from('brands').select('name, domain').eq('status', 'approved').limit(40),
    ]);

    const knownDomains = new Set((allBrands ?? []).map(b => cleanDomain(b.domain)));
    const rejectedNames = (rejectedBrands ?? []).map(b => b.name).filter(Boolean);
    const approved = (approvedBrands ?? []) as { name: string; domain: string }[];

    // Layers 1, 2, 4 run in parallel (all independent)
    const [seedCandidates, editorialCandidates, nuulyCandidates] = await Promise.all([
      discoverFromSeeds(exaKey, approved, rejectedNames, knownDomains),
      anthropicKey
        ? discoverFromEditorial(exaKey, anthropicKey, knownDomains, rejectedNames)
        : Promise.resolve([] as Candidate[]),
      anthropicKey
        ? discoverFromNuuly(exaKey, anthropicKey, knownDomains, rejectedNames)
        : Promise.resolve([] as Candidate[]),
    ]);

    // Layer 3: keyword fallback — exclude anything layers 1+2+4 already found
    const alreadyFound = new Set([
      ...knownDomains,
      ...seedCandidates.map(c => c.domain),
      ...editorialCandidates.map(c => c.domain),
      ...nuulyCandidates.map(c => c.domain),
    ]);
    const keywordCandidates = await discoverFromKeywords(exaKey, rejectedNames, alreadyFound);

    // Final dedup across all four layers
    const seenDomains = new Set<string>();
    const candidates: Candidate[] = [];
    for (const c of [...seedCandidates, ...editorialCandidates, ...nuulyCandidates, ...keywordCandidates]) {
      const domain = cleanDomain(c.domain);
      if (!domain || seenDomains.has(domain) || knownDomains.has(domain)) continue;
      seenDomains.add(domain);
      candidates.push({ ...c, domain });
    }

    return respond({
      found_new: candidates.length,
      breakdown: {
        seed:       seedCandidates.filter(c => !knownDomains.has(c.domain)).length,
        editorial:  editorialCandidates.filter(c => !knownDomains.has(c.domain)).length,
        nuuly:      nuulyCandidates.filter(c => !knownDomains.has(c.domain)).length,
        keyword:    keywordCandidates.filter(c => !knownDomains.has(c.domain)).length,
      },
      context: {
        approved_seeds: approved.length,
        rejected_anti_examples: rejectedNames.length,
        editorial_enabled: !!anthropicKey,
      },
      candidates,
    });
  } catch (err) {
    return respond({ error: String(err) }, 500);
  }
});

