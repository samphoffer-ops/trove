import { useEffect, useState } from 'react';
import { Image as RNImage, StyleSheet, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import Animated, {
  Easing, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withTiming,
} from 'react-native-reanimated';
import { Animation, Colors } from '@/lib/theme';
import { Wordmark } from './TroveLockup';

// The native splash (app.json) is navy with the warm-white mark, 200pt wide and
// centered. This screen redraws it pixel for pixel, so swapping the native
// splash for it is invisible, then fades the wordmark in under the mark and
// dissolves into the app: 240 + 260 + 360 = 860ms.
const MARK = 200;
// The artwork's heart ends ~79pt below the image's center; sit the word under it.
const WORD_TOP = 88;
const WORD_SIZE = 40;
const HOLD = 260;
// Static, pre-rendered noise; the launch screen is the only place grain appears.
const GRAIN_OPACITY = 0.05;

const SPLASH_IMAGE = require('../../assets/trove-mark-splash.png');
const GRAIN = require('../../assets/paper-grain.png');

SplashScreen.setOptions({ fade: false });

interface Props {
  /** Fonts and the initial session are ready; start the sequence. */
  ready: boolean;
  onDone: () => void;
}

export function LaunchScreen({ ready, onDone }: Props) {
  const { height } = useWindowDimensions();
  const word = useSharedValue(0);
  const screen = useSharedValue(1);
  // Hide the native splash only once our copy of the mark has decoded, or the
  // handoff shows a frame of bare navy.
  const [markLoaded, setMarkLoaded] = useState(false);

  useEffect(() => {
    if (!ready || !markLoaded) return;
    SplashScreen.hide();
    word.value = withTiming(1, { duration: Animation.standard, easing: Easing.out(Easing.cubic) });
    screen.value = withDelay(
      Animation.standard + HOLD,
      withTiming(0, { duration: Animation.complex, easing: Easing.inOut(Easing.quad) }, done => {
        if (done) runOnJS(onDone)();
      }),
    );
  }, [ready, markLoaded]);

  const screenStyle = useAnimatedStyle(() => ({ opacity: screen.value }));
  // The native splash has no grain, so it fades in with the word rather than
  // popping in at the handoff.
  const grainStyle = useAnimatedStyle(() => ({ opacity: word.value * GRAIN_OPACITY }));
  const wordStyle = useAnimatedStyle(() => ({
    opacity: word.value,
    transform: [{ translateY: (1 - word.value) * 6 }],
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, screenStyle]} pointerEvents={ready ? 'none' : 'auto'}>
      <StatusBar style="light" />
      <Animated.View style={[StyleSheet.absoluteFill, grainStyle]}>
        <RNImage source={GRAIN} resizeMode="repeat" style={StyleSheet.absoluteFill} />
      </Animated.View>
      <RNImage source={SPLASH_IMAGE} style={styles.mark} resizeMode="contain" onLoad={() => setMarkLoaded(true)} />
      <Animated.View style={[styles.wordRow, { top: height / 2 + WORD_TOP }, wordStyle]}>
        <Wordmark size={WORD_SIZE} color={Colors.bg} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    zIndex: 100,
    backgroundColor: Colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: { width: MARK, height: MARK },
  wordRow: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
});
