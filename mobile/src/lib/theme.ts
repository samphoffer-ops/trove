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
  badge: 4, input: 12, card: 5, modal: 15, nav: 32, pill: 999, phone: 44,
};

// Mulish weights in sync with useFonts() in app/_layout.tsx.
// Hierarchy comes from size and placement, not weight: editorial headers are
// oversized italics (displayXl is 4x body), everything else tops out at SemiBold.
export const Typography: Record<string, TextStyle> = {
  // Page masthead, onboarding reveal, editorial bento headers
  displayXl: {
    fontFamily: 'Mulish_400Regular_Italic',
    fontSize: 64,
    letterSpacing: -1.6,
    lineHeight: 62,
  },
  // Step titles, board name on cover, empty-state headers
  display: {
    fontFamily: 'Mulish_500Medium_Italic',
    fontSize: 40,
    letterSpacing: -0.8,
    lineHeight: 40,
  },
  // Product name on detail, sheet titles, section heads
  headline: {
    fontFamily: 'Mulish_500Medium',
    fontSize: 22,
    letterSpacing: -0.2,
    lineHeight: 28,
  },
  // Button labels, board names, list-row titles
  cardTitle: {
    fontFamily: 'Mulish_600SemiBold',
    fontSize: 15,
    lineHeight: 20,
  },
  body: {
    fontFamily: 'Mulish_400Regular',
    fontSize: 16,
    lineHeight: 23,
  },
  // Counts, meta, helper text, product name on cards
  caption: {
    fontFamily: 'Mulish_400Regular',
    fontSize: 13,
    lineHeight: 18,
  },
  // "Why it's in your edit", onboarding subtitles
  subhead: {
    fontFamily: 'Mulish_400Regular_Italic',
    fontSize: 17,
    lineHeight: 24,
  },
  // Brand on cards and detail, quiet section labels
  label: {
    fontFamily: 'Mulish_500Medium',
    fontSize: 12,
    lineHeight: 16,
  },
  // Wordmark, not a type role
  logo: {
    fontFamily: 'Mulish_900Black',
    fontSize: 22,
    letterSpacing: -0.6,
    lineHeight: 22,
  },
  price: {
    fontFamily: 'Mulish_500Medium',
    fontSize: 12,
    lineHeight: 16,
    fontVariant: ['tabular-nums'],
  },
};

// Text props for displayXl/display: body text scales freely with Dynamic Type,
// editorial headers are capped so a 64pt masthead survives the largest sizes.
export const DisplayScaling = { maxFontSizeMultiplier: 1.2 };

export const Spacing = {
  1: 4,
  2: 6,
  3: 8,
  4: 12,
  5: 18,
  6: 28,
  screen: 24,   // outer screen margin
  gutter: 8,    // masonry and board-grid gutter
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
