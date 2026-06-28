import { View, StyleSheet, ImageSourcePropType } from 'react-native';
import { Image } from 'expo-image';
import { Colors, Shadows } from '@/lib/theme';

interface Props {
  source?: ImageSourcePropType;
  width?: number;
}

// Real screenshots are captured at a 390x844 logical viewport (see
// mobile/assets/screenshots) — the frame's inner screen area is sized to
// that exact ratio so the image is never cropped or letterboxed.
const SCREEN_RATIO = 390 / 844;
const PADDING = 12;

// A simple device-frame wrapper for real app screenshots on the marketing site.
// Pass no `source` to render an empty placeholder until a screenshot is captured.
export function PhoneMockup({ source, width = 280 }: Props) {
  const innerWidth = width - PADDING * 2;
  const innerHeight = innerWidth / SCREEN_RATIO;
  const height = innerHeight + PADDING * 2;

  return (
    <View style={[styles.frame, { width, height, borderRadius: width * 0.13, padding: PADDING }]}>
      <View style={[styles.screen, { borderRadius: width * 0.1 }]}>
        {source ? (
          <Image source={source} style={StyleSheet.absoluteFill} contentFit="contain" />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.placeholder]} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: '#0B0C1D',
    ...Shadows.phone,
  },
  screen: { flex: 1, overflow: 'hidden', backgroundColor: Colors.stoneSoft },
  placeholder: { backgroundColor: Colors.stoneSoft },
});
