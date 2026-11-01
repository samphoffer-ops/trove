import { useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, AccessibilityInfo, Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing, ReduceMotion, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue,
  withDelay, withSpring, withTiming, type SharedValue,
} from 'react-native-reanimated';
import { Colors, Typography, Spacing, DisplayScaling, Animation } from '@/lib/theme';
import * as haptics from '@/lib/haptics';

const LINES = ['Your', 'edit is', 'ready'];
const HOLD_MS = 1400;
const STAGGER_MS = 90;
const EASE_OUT = Easing.bezier(0.2, 0.8, 0.2, 1);
const NEVER = ReduceMotion.Never; // we pick the reduced variant ourselves
// Masks extend below the 1.0 line height so descenders (y) aren't clipped,
// and overlap the next line by the same amount to keep the leading tight.
const DESCENDER = 16;

// Full-bleed coral, no product imagery (design-spec §2, §9). Coral rises from
// the bottom edge, the header sets line by line out of masks, a success
// haptic lands with the last line, it holds, then the coral lifts away to the
// warm white the feed sits on and onDone() hands over to the feed.
// Reduce Motion: every move becomes a crossfade. Tap anywhere to go sooner;
// with VoiceOver on it waits for the tap instead of a timer.
export function Reveal({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const { height, fontScale } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  // Line height as rendered, after the DisplayScaling cap on Dynamic Type.
  const lineH = (Typography.displayXl.lineHeight as number) * Math.min(fontScale, DisplayScaling.maxFontSizeMultiplier);

  const panel = useSharedValue(0); // 0 hidden → 1 covering → 2 lifted away
  const lines = [useSharedValue(0), useSharedValue(0), useSharedValue(0)];
  const exiting = useRef(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function exit() {
    if (exiting.current) return;
    exiting.current = true;
    clearTimeout(holdTimer.current);
    const d = Animation.complex;
    lines.forEach(l => { l.value = withTiming(2, { duration: Animation.standard, reduceMotion: NEVER }); });
    panel.value = withDelay(
      Animation.micro,
      withTiming(2, { duration: d, easing: EASE_OUT, reduceMotion: NEVER }, finished => {
        if (finished) runOnJS(onDone)();
      }),
    );
  }

  function settled() {
    haptics.onboardingComplete();
    // react-native-web always reports a screen reader, so only trust it on native.
    const screenReader = Platform.OS === 'web' ? Promise.resolve(false) : AccessibilityInfo.isScreenReaderEnabled();
    screenReader.then(on => {
      if (on) { AccessibilityInfo.announceForAccessibility('Your edit is ready. Double tap to open your feed.'); return; }
      holdTimer.current = setTimeout(exit, HOLD_MS);
    });
  }

  useEffect(() => {
    panel.value = withTiming(1, { duration: reduceMotion ? Animation.standard : Animation.complex, easing: EASE_OUT, reduceMotion: NEVER });
    const start = reduceMotion ? Animation.standard : Animation.complex * 0.6;
    lines.forEach((l, i) => {
      const delay = reduceMotion ? start : start + i * STAGGER_MS;
      const to = reduceMotion
        ? withTiming(1, { duration: Animation.standard, reduceMotion: NEVER })
        : withSpring(1, { ...Animation.spring, reduceMotion: NEVER });
      l.value = withDelay(delay, to);
    });
    const lastIn = start + (reduceMotion ? 0 : (LINES.length - 1) * STAGGER_MS) + Animation.standard;
    const t = setTimeout(settled, lastIn);
    return () => { clearTimeout(t); clearTimeout(holdTimer.current); };
  }, []);

  const panelStyle = useAnimatedStyle(() => {
    if (reduceMotion) return { opacity: panel.value <= 1 ? panel.value : 2 - panel.value };
    return {
      transform: [{ translateY: panel.value <= 1 ? (1 - panel.value) * height : -(panel.value - 1) * height }],
    };
  });

  // Once coral covers the screen, warm white replaces the step underneath, so
  // the lift uncovers the feed's background rather than the last step.
  const backdropStyle = useAnimatedStyle(() => ({ opacity: panel.value >= 1 ? 1 : 0 }));

  return (
    <View style={StyleSheet.absoluteFill}>
    <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} />
    <Animated.View style={[StyleSheet.absoluteFill, styles.panel, panelStyle]}>
      <Pressable
        style={[styles.press, { paddingTop: insets.top, paddingBottom: insets.bottom + Spacing[6] * 2 }]}
        onPress={exit}
        accessibilityRole="button"
        accessibilityLabel="Your edit is ready"
        accessibilityHint="Opens your feed"
      >
        <View>
          {LINES.map((text, i) => (
            <Line key={text} text={text} progress={lines[i]} lineH={lineH} reduceMotion={reduceMotion} />
          ))}
        </View>
      </Pressable>
    </Animated.View>
    </View>
  );
}

// Each line rises out of its own mask (0 → 1), then drifts up and out on exit (1 → 2).
function Line({ text, progress, lineH, reduceMotion }: {
  text: string; progress: SharedValue<number>; lineH: number; reduceMotion: boolean;
}) {
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    const opacity = p <= 1 ? p : 2 - p;
    if (reduceMotion) return { opacity };
    const y = p <= 1 ? (1 - p) * lineH : -(p - 1) * lineH * 0.4;
    return { opacity, transform: [{ translateY: y }] };
  });
  return (
    <View style={[styles.mask, { height: lineH + DESCENDER, marginBottom: -DESCENDER }]}>
      <Animated.View style={style}>
        <Text {...DisplayScaling} style={styles.header} accessible={false}>{text}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: Colors.bg },
  panel:  { backgroundColor: Colors.accent },
  press:  { flex: 1, justifyContent: 'flex-end', paddingHorizontal: Spacing.screen },
  mask:   { overflow: 'hidden' },
  header: { ...Typography.displayXl, color: Colors.ink },
});
