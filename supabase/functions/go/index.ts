import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHandler } from './handler.ts';

// Deployed with --no-verify-jwt: the browser opens this URL directly, so
// there's no Authorization header to verify. See handler.ts for why that's
// safe (no open redirect) and how the user is attributed.
const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

Deno.serve(createHandler({
  findActiveProduct: async (id) => {
    const { data, error } = await admin
      .from('products')
      .select('id, url')
      .eq('id', id)
      .eq('status', 'active')
      .maybeSingle();
    if (error) throw error;
    return data;
  },
  logClickOut: async ({ userId, productId, url, via }) => {
    const { error } = await admin.from('events').insert({
      user_id:    userId,
      type:       'click_out',
      product_id: productId,
      properties: via ? { url, source: 'go', via } : { url, source: 'go' },
    });
    // A u= that isn't a real user fails the FK and is dropped here.
    if (error) throw error;
  },
  defer: (work) => {
    if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(work);
  },
  skimlinksPublisherId: Deno.env.get('SKIMLINKS_PUBLISHER_ID') || undefined,
}));
