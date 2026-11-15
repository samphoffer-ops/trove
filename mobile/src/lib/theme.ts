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

// Two faces. Young Serif (one weight, no italic) is for large text only, about
// 22pt and up: editorial headers, display and the wordmark. Never set
// fontWeight or fontStyle on it, or iOS fakes a bold or slant. Everything else
// leaves fontFamily unset so it renders in the system font (SF Pro), with
// hierarchy from size and weight. Fonts load in app/_layout.tsx.
const SERIF = 'YoungSerif_400Regular';
// Young Serif tracking: about -0.035em.
export const serifTracking = (size: number) => Math.round(size * -0.035 * 100) / 100;

export const Typography: Record<string, TextStyle> = {
  // Page masthead, onboarding reveal, editorial bento headers
  displayXl: {
    fontFamily: SERIF,
    fontSize: 48,
    letterSpacing: serifTracking(48),
    lineHeight: 52,
  },
  // Step titles, board name on cover, empty-state headers
  display: {
    fontFamily: SERIF,
    fontSize: 40,
    letterSpacing: serifTracking(40),
    lineHeight: 44,
  },
  // Product name on detail, sheet titles, section heads
  headline: {
    fontFamily: SERIF,
    fontSize: 22,
    letterSpacing: serifTracking(22),
    lineHeight: 28,
  },
  // Headline weight in the system font, for anything set below 22pt or that
  // isn't a heading (button labels, avatar initials, counters).
  headlineSans: {
    fontSize: 22,
    fontWeight: '500',
    letterSpacing: -0.2,
    lineHeight: 28,
  },
  // Button labels, board names, list-row titles
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  body: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 23,
  },
  // Counts, meta, helper text, product name on cards
  caption: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
  },
  // Onboarding subtitles
  subhead: {
    fontSize: 17,
    fontWeight: '400',
    lineHeight: 24,
  },
  // Brand on cards and detail, quiet section labels
  label: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  // The word in TroveLockup, not a type role
  wordmark: {
    fontFamily: SERIF,
    fontSize: 24,
    letterSpacing: serifTracking(24),
  },
  price: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    fontVariant: ['tabular-nums'],
  },
};

// Text props for displayXl/display: body text scales freely with Dynamic Type,
// editorial headers are capped so a 64pt masthead survives the largest sizes.
export const DisplayScaling = { maxFontSizeMultiplier: 1.2 };

// Short serif headers stay on one line: rather than wrap, shrink up to 15% to
// fit narrow phones and larger Dynamic Type. Only for copy that fits at full
// size on a standard iPhone; long or user-supplied titles should wrap instead.
export const OneLineHeader = { numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: 0.85 } as const;

export const Spacing = {
  1: 4,
  2: 6,
  3: 8,
  4: 12,
  5: 18,
  6: 28,
  screen: 24,   // outer screen margin
  gutter: 8,    // masonry and board-grid gutter
  bento: 2,     // hairline between tiles inside a board's bento cover
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
