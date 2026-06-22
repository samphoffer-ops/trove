# External connections

Every third-party service Trove depends on, where its credentials live, and what consumes it. Keep this updated when adding or removing a connection — it's the single place to check "what's wired up and where."

| Service | Used for | Credential(s) | Where the credential lives | Consumed by |
|---|---|---|---|---|
| **Supabase** | Database, Auth, Storage, Edge Functions — the entire backend | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`; service-role key (server-side only) | `mobile/.env` (anon key/url); service-role key is set directly in each Edge Function's runtime by Supabase, never in the repo | Entire app (`mobile/src/lib/supabase.ts`); all Edge Functions |
| **Anthropic API** | LLM-as-judge: scores each candidate brand against Trove's taste rubric | `ANTHROPIC_API_KEY` | Supabase Dashboard → Edge Functions → Secrets (project-wide) | `supabase/functions/catalog-intake/index.ts` |
| **Exa** | Brand discovery — finds new candidate brand domains via search, returns structured `{name, domain}` pairs | `EXA_API_KEY` | Supabase Dashboard → Edge Functions → Secrets (project-wide) | `supabase/functions/discover-brands/index.ts` |
| **Voyage AI** | Text embeddings for every product (brand + name + description) — powers the semantic taste-ranking engine | `VOYAGE_API_KEY` | Supabase Dashboard → Edge Functions → Secrets (project-wide) | `supabase/functions/catalog-intake/index.ts` (embeds at scrape time); stored on `products.embedding`, read by the `rank_products_for_user` Postgres function |
| **Skimlinks** | Affiliate link wrapping on outbound "Shop now" taps — monetization | `EXPO_PUBLIC_SKIMLINKS_PUBLISHER_ID` (`305002X1793194`, approved) | `mobile/.env` | `mobile/src/lib/affiliate.ts` |
| **GitHub Pages** | Hosts the web build at shoptrove.app | none (public deploy, no API key) | `.github/workflows/deploy.yml` | Auto-deploys on every push to `main` |

## Pipeline relationship (Exa + Anthropic + Voyage + Supabase)

`discover-brands` (Exa) finds candidate domains → fed manually into `catalog-intake` (Anthropic judges + scrapes + Voyage embeds each product) → lands in the `brands`/`products` tables → Sam approves/rejects brands in the Table Editor. The two discovery functions are deliberately not chained automatically — see the comment at the top of `discover-brands/index.ts` for why. Once products are live, the `rank_products_for_user` Postgres function (migration 010) does the actual feed personalization at read time, using pgvector to compare each user's behavioral "taste vector" against product embeddings.

## Not yet connected

- Real scheduling/cron for `discover-brands` + `catalog-intake` — both are currently triggered manually
- Collaborative/"invisible social" signal (other users' behavior influencing each other) — not enough users yet for that to mean anything
