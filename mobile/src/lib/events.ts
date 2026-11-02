import { supabase } from '@/lib/supabase';

export type EventType = 'save' | 'product_open' | 'click_out' | 'not_for_me';

type EventExtras = { boardId?: string; properties?: Record<string, unknown> };

// Fire-and-forget: returns immediately, never throws, never blocks the UI.
// getSession() reads the stored session locally (no network round trip like
// getUser()), and signed-out taps are simply not logged. The insert has no
// .select(), since RLS lets clients insert events but not read them back.
export function logEvent(type: EventType, productId: string | null, extras: EventExtras = {}): void {
  void (async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { error } = await supabase.from('events').insert({
        user_id:    session.user.id,
        type,
        product_id: productId,
        board_id:   extras.boardId ?? null,
        properties: extras.properties ?? {},
      });
      if (error && __DEV__) console.warn(`[events] ${type} not logged:`, error.message);
    } catch (e) {
      if (__DEV__) console.warn(`[events] ${type} not logged:`, e);
    }
  })();
}
