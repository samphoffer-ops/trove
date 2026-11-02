import { View } from 'react-native';

// Feed card → product detail shared-element transition (docs/design-spec.md §5).
//
// Reanimated 4.1 (pinned by Expo SDK 54) has no sharedTransitionTag and
// expo-router 6 has no zoom transition, so this is hand-built: the card
// image registers its native view here, openProduct() measures it before
// pushing, and the detail screen (presented as a transparent modal so the
// feed stays visible underneath) grows its hero from that rect and shrinks
// back into it on dismiss. No registered source (board, inbox, deep link,
// web) means the detail screen crossfades instead.

export type Rect = { x: number; y: number; width: number; height: number };

const sources = new Map<string, View>();
const pending = new Map<string, Rect>();

// Spread onto the card's image container: {...sharedTransitionSource(product.id)}
export function sharedTransitionSource(productId: string) {
  let mine: View | null = null;
  return {
    collapsable: false,
    ref: (node: View | null) => {
      if (node) {
        mine = node;
        sources.set(productId, node);
      } else if (sources.get(productId) === mine) {
        sources.delete(productId);
      }
    },
  };
}

// Resolves with the source's window rect, or null if there isn't a usable one.
export function measureSource(productId: string): Promise<Rect | null> {
  const node = sources.get(productId);
  if (!node) return Promise.resolve(null);
  return new Promise(resolve => {
    node.measureInWindow((x, y, width, height) => {
      resolve(width > 0 && height > 0 ? { x, y, width, height } : null);
    });
  });
}

export function setPendingSource(productId: string, rect: Rect) {
  pending.set(productId, rect);
}

// Read once by the detail screen on mount.
export function takePendingSource(productId: string): Rect | null {
  const rect = pending.get(productId) ?? null;
  pending.delete(productId);
  return rect;
}

// The card image is hidden while the hero is in flight, so the photo reads
// as one object lifting out of the grid rather than a copy.
export function setSourceHidden(productId: string, hidden: boolean) {
  try {
    sources.get(productId)?.setNativeProps({ style: { opacity: hidden ? 0 : 1 } });
  } catch {
    // Cosmetic only; never block navigation on it.
  }
}
