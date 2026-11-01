import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

// One function per row of the haptics table in docs/design-spec.md §4.
// Call sites use these, never expo-haptics directly. Fire-and-forget:
// no-op on web, and failures (e.g. no Taptic Engine) are swallowed.

function fire(run: () => Promise<void>) {
  if (Platform.OS === 'web') return;
  run().catch(() => {});
}

// Soft was added to expo-haptics later than Light; fall back if it's missing.
const SOFT = Haptics.ImpactFeedbackStyle.Soft ?? Haptics.ImpactFeedbackStyle.Light;

/** Onboarding selection (brand, style, image yes/no) and other checkmark toggles. */
export function onboardingSelect() {
  fire(() => Haptics.selectionAsync());
}

/** Save to Board. */
export function saveToBoard() {
  fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

/** "Not for me". */
export function notForMe() {
  fire(() => Haptics.impactAsync(SOFT));
}

/** Board created. */
export function boardCreated() {
  fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

/** Onboarding complete. */
export function onboardingComplete() {
  fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

/** Long-press opens quick actions. Not a table row: closest entry is the Light impact. */
export function quickActionsOpen() {
  fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}
