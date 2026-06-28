import { TextStyle } from 'react-native';

export const Colors = {
  bg:          '#FFF8F0',
  surface:     '#FFFFFF',
  text:        '#0B0C1D',
  textMuted:   '#7A7B8A',
  accent:      '#FF4A1C',
  accentLime:  '#E8F353',
  accentBlue:  '#5C85FF',
  stone:       '#C4B09A',
  stoneSoft:   '#F5EFE6',
  border:      '#EDE8E1',
  destructive: '#B5483D',
  overlay:     'rgba(20,18,16,0.4)',
};

// sm/md/full are the originals every screen already imports — kept as-is.
// The named scale below (badge/input/card/nav/pill/phone) is additive, for
// new screens that want a more specific radius than "small or medium."
export const Radius = {
  sm: 10, md: 18, full: 999,
  badge: 4, input: 10, card: 16, nav: 24, pill: 999, phone: 44,
};

// Mulish weights below must stay in sync with the useFonts() call in
// app/_layout.tsx — a weight referenced here but not loaded there silently
// falls back to the system font instead of erroring.
export const Typography: Record<string, TextStyle> = {
  display: {
    fontFamily: 'Mulish_900Black',
    fontSize: 22,
    letterSpacing: -0.4,
    lineHeight: 26,
  },
  headline: {
    fontFamily: 'Mulish_800ExtraBold',
    fontSize: 17,
    letterSpacing: -0.2,
    lineHeight: 22,
  },
  cardTitle: {
    fontFamily: 'Mulish_700Bold',
    fontSize: 13,
    lineHeight: 16,
  },
  body: {
    fontFamily: 'Mulish_400Regular',
    fontSize: 13,
    lineHeight: 20,
  },
  caption: {
    fontFamily: 'Mulish_600SemiBold',
    fontSize: 11,
    lineHeight: 14,
  },
  subhead: {
    fontFamily: 'Mulish_300Light_Italic',
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.01,
  },
  label: {
    fontFamily: 'Mulish_900Black',
    fontSize: 8,
    letterSpacing: 0.12,
    lineHeight: 10,
    textTransform: 'uppercase',
  },
  logo: {
    fontFamily: 'Mulish_900Black',
    fontSize: 22,
    letterSpacing: -0.6,
    lineHeight: 22,
  },
  dmLabel: {
    fontFamily: 'Mulish_800ExtraBold',
    fontSize: 10,
    letterSpacing: 0.04,
    lineHeight: 12,
  },
};

export const Spacing = {
  1: 4,
  2: 6,
  3: 8,
  4: 12,
  5: 18,
  6: 28,
  safeBottom: 34,
  dynamicIsland: 54,
};

export const Shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 4,
  },
  phone: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.32,
    shadowRadius: 60,
    elevation: 20,
  },
};

export const Animation = {
  micro: 150,
  standard: 250,
  complex: 380,
  spring: {
    damping: 18,
    stiffness: 200,
    mass: 1,
  },
};
