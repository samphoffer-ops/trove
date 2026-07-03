import { TextStyle } from 'react-native';

export const Colors = {
  // Core surfaces
  bg:          '#FFF8F0',   // warm off-white (brand)
  surface:     '#FFFFFF',

  // Text — Inky Black from brand guide
  text:        '#0D1035',
  textMuted:   '#6B6D84',
  textLight:   'rgba(13,16,53,0.38)',

  // Brand: Coral — PRIMARY ACTIONS ONLY (CTAs, saves when active)
  accent:      '#FF4422',
  accentSoft:  '#FF7A60',
  accentMist:  '#FFB5A5',
  accentPale:  '#FFE4DC',

  // Brand: Chartreuse — active/selected states
  accentLime:  '#D6E849',
  accentLimeSoft: '#E2EE6D',
  accentLimeMist: '#EEF5A8',

  // Brand: Sky Blue — informational (prices, brand links, secondary actions)
  accentBlue:  '#7C9EF0',
  accentBlueSoft: '#A4BCF5',
  accentBlueMist: '#D5E1FB',

  // Brand: Inky Black — dark surfaces (tab bar, overlays, premium moments)
  ink:         '#0D1035',
  inkMid:      '#252659',
  inkSoft:     '#6B6F9F',
  inkGhost:    'rgba(13,16,53,0.06)',

  // Neutrals
  stone:       '#C4B09A',
  stoneSoft:   '#F2EBE1',
  border:      '#EAE4DC',
  borderStrong:'#D4C8BC',
  destructive: '#B5483D',
  overlay:     'rgba(13,16,53,0.5)',
};

export const Radius = {
  // Legacy (screens still reference these)
  sm: 10, md: 18, full: 999,
  // Named scale
  badge: 4, input: 12, card: 14, nav: 32, pill: 999, phone: 44,
};

// Mulish weights in sync with useFonts() in app/_layout.tsx.
export const Typography: Record<string, TextStyle> = {
  // Page-level masthead ("for you", "boards") — editorial impact
  displayXl: {
    fontFamily: 'Mulish_900Black',
    fontSize: 40,
    letterSpacing: -1.6,
    lineHeight: 42,
  },
  // Section & content headings
  display: {
    fontFamily: 'Mulish_900Black',
    fontSize: 26,
    letterSpacing: -0.8,
    lineHeight: 30,
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
    lineHeight: 17,
  },
  body: {
    fontFamily: 'Mulish_400Regular',
    fontSize: 14,
    lineHeight: 22,
  },
  caption: {
    fontFamily: 'Mulish_600SemiBold',
    fontSize: 11,
    lineHeight: 14,
  },
  subhead: {
    fontFamily: 'Mulish_300Light_Italic',
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.01,
  },
  label: {
    fontFamily: 'Mulish_900Black',
    fontSize: 9,
    letterSpacing: 0.16,
    lineHeight: 11,
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
  // Price — distinct enough from cardTitle so hierarchy reads at a glance
  price: {
    fontFamily: 'Mulish_700Bold',
    fontSize: 13,
    lineHeight: 17,
    letterSpacing: -0.1,
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
  // Card-level: barely perceptible lift, lets imagery do the work
  card: {
    shadowColor: '#0D1035',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  // For floating panels, sheets, modals
  elevated: {
    shadowColor: '#0D1035',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 30,
    elevation: 10,
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
  micro: 140,
  standard: 240,
  complex: 360,
  spring: {
    damping: 18,
    stiffness: 200,
    mass: 1,
  },
};
