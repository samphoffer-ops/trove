import { View, StyleSheet, Platform } from 'react-native';
import { Colors } from '@/lib/theme';

// The app (as opposed to the marketing site, which has its own wider
// max-width treatment) is designed mobile-first for a ~390px viewport. On a
// wide desktop browser that translates literally — unconstrained flex grids
// (the feed's 2-column masonry, etc.) stretch to fill the whole window,
// producing comically oversized cards, and the floating tab bar's
// `left/right` offsets resolve against the full viewport instead of a phone-
// width column. Wrapping screens in this centers a phone-width column
// instead of stretching. No-op on native, where this isn't an issue.
export function WebFrame({ children }: { children: React.ReactNode }) {
  if (Platform.OS !== 'web') return <>{children}</>;
  return (
    <View style={styles.outer}>
      <View style={styles.inner}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, width: '100%', alignItems: 'center', backgroundColor: Colors.bg },
  inner: { flex: 1, width: '100%', maxWidth: 480 },
});
