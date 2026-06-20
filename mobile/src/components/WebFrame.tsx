import { View, StyleSheet, Platform } from 'react-native';
import { Colors } from '@/lib/theme';

// The app (as opposed to the marketing site, which has its own wider
// max-width treatment) is mobile-first with no width constraint of its own.
// On a wide desktop browser that's a problem for two different reasons that
// need two different answers: forms/detail screens just need to not stretch
// edge-to-edge (narrow column, 480px), while grid/discovery screens (feed,
// search) should actually use the extra width to show more products at once
// — see MasonryGrid, which grows column count with available width up to
// 1100px. This wrapper just needs to stop constraining those screens tighter
// than that, so its default is wide; pass maxWidth=480 for narrow content.
// No-op on native, where this isn't an issue.
export function WebFrame({ children, maxWidth = 1100 }: { children: React.ReactNode; maxWidth?: number }) {
  if (Platform.OS !== 'web') return <>{children}</>;
  return (
    <View style={styles.outer}>
      <View style={[styles.inner, { maxWidth }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, width: '100%', alignItems: 'center', backgroundColor: Colors.bg },
  inner: { flex: 1, width: '100%' },
});
