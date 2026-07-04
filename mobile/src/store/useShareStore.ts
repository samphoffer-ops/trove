import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { Product, Share } from '@/types';

interface ShareState {
  inbox:        Share[];
  unreadCount:  number;
  fetchInbox:   () => Promise<void>;
  sendShare:    (recipientIds: string[], product: Product, message?: string) => Promise<void>;
  sendMessage:  (recipientId: string, body: string) => Promise<void>;
  markRead:     (shareId: string) => Promise<void>;
}

export const useShareStore = create<ShareState>((set, get) => ({
  inbox:       [],
  unreadCount: 0,

  async fetchInbox() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('shares')
      .select('*, profiles!shares_sender_id_fkey(*)')
      .eq('recipient_id', user.id)
      .order('created_at', { ascending: false });
    const inbox = (data ?? []) as Share[];
    set({ inbox, unreadCount: inbox.filter(s => !s.read_at).length });
  },

  async sendShare(recipientIds, product, message) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || recipientIds.length === 0) return;
    const msg = message?.trim() || null;
    await supabase.from('shares').insert(
      recipientIds.map(recipientId => ({
        sender_id:    user.id,
        recipient_id: recipientId,
        product_id:   product.id,
        product_data: product,
        message:      msg,
      })),
    );
  },

  async sendMessage(recipientId, body) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !body.trim()) return;
    await supabase.from('shares').insert({
      sender_id:    user.id,
      recipient_id: recipientId,
      product_id:   null,
      product_data: null,
      message:      body.trim(),
    });
  },

  async markRead(shareId) {
    const wasUnread = get().inbox.some(s => s.id === shareId && !s.read_at);
    if (!wasUnread) return;
    await supabase.from('shares').update({ read_at: new Date().toISOString() }).eq('id', shareId);
    set(state => ({
      inbox:       state.inbox.map(s => s.id === shareId ? { ...s, read_at: new Date().toISOString() } : s),
      unreadCount: Math.max(0, state.unreadCount - 1),
    }));
  },
}));
