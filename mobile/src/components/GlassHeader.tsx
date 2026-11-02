import { ReactNode } from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { router } from 'expo-router';
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Logo } from '@/components/Logo';
import { GearIcon, ProfileIcon } from '@/components/Icons';
import { Colors, Radius, Spacing } from '@/lib/theme';

const CONTROL_SIZE = 44; // Apple's minimum hit target
const LOGO_WIDTH = 72;

// Height of the header row below the safe area. Screens pad their scroll
// content by insets.top + GLASS_HEADER_HEIGHT so it starts below the
// controls and then scrolls underneath them.
export const GLASS_HEADER_HEIGHT = CONTROL_SIZE + Spacing[4] * 2;

// Glass is only for controls floating over content (design spec §3), so the
// header itself has no background: just the three controls, each its own
// piece of glass. On iOS < 26 (and web) there's no Liquid Glass, so fall
// back to a light system blur.
export function Glass({ style, children }: { style: ViewStyle; children: ReactNode }) {
  if (isLiquidGlassAvailable()) {
    return <GlassView glassEffectStyle="regular" isInteractive style={style}>{children}</GlassView>;
  }
  return (
    <View style={[style, styles.fallbackClip]}>
      <BlurView intensity={60} tint="systemThinMaterialLight" style={StyleSheet.absoluteFill} />
      {children}
    </View>
  );
}

// Logo wordmark left; profile and settings right (design spec §7).
export function GlassHeader() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: insets.top + Spacing[4] }]} pointerEvents="box-none">
      <Pressable
        onPress={() => router.navigate('/(tabs)/feed')}
        accessibilityRole="button"
        accessibilityLabel="Trove, go to feed"
      >
        <Glass style={styles.logoCapsule}>
          <Logo width={LOGO_WIDTH} color={Colors.text} />
        </Glass>
      </Pressable>

      <View style={styles.actions}>
        <Pressable onPress={() => router.push('/profile')} accessibilityRole="button" accessibilityLabel="Profile">
          <Glass style={styles.circle}>
            <ProfileIcon color={Colors.text} size={20} />
          </Glass>
        </Pressable>
        <Pressable onPress={() => router.push('/settings')} accessibilityRole="button" accessibilityLabel="Settings">
          <Glass style={styles.circle}>
            <GearIcon color={Colors.text} size={20} />
          </Glass>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position:          'absolute',
    top: 0, left: 0, right: 0,
    zIndex:            10,
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: Spacing[5],
    paddingBottom:     Spacing[4],
  },
  actions: { flexDirection: 'row', gap: Spacing[3] },
  logoCapsule: {
    height:            CONTROL_SIZE,
    paddingHorizontal: Spacing[5],
    borderRadius:      Radius.pill,
    justifyContent:    'center',
  },
  circle: {
    width:          CONTROL_SIZE,
    height:         CONTROL_SIZE,
    borderRadius:   Radius.pill,
    alignItems:     'center',
    justifyContent: 'center',
  },
  fallbackClip: { overflow: 'hidden' },
});
