import { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Radius, Shadows, Spacing, Typography } from '@/lib/theme';
import { GridIcon, BoardsIcon, SearchIcon, ProfileIcon } from '@/components/Icons';

const CONTENT_MAX_WIDTH = 1100;
const TAB_BAR_HEIGHT = 62;
const TAB_BAR_TOP_PAD = 10;
const FLOAT_MARGIN = 16;

export default function TabsLayout() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // Static export prerenders this in Node, where useWindowDimensions falls
  // back to a value no real browser matches — baking a different padding
  // number into the static HTML than the client computes on first render.
  // This tab bar renders on every single screen, so it's a candidate for
  // the same hydration-mismatch class as MasonryGrid (see its comment).
  // Not measured to be the actual trigger, but cheap and correct to fix
  // the same way: use the real width only once mounted.
  const [mounted, setMounted] = useState(Platform.OS !== 'web');
  useEffect(() => { setMounted(true); }, []);
  const effectiveWidth = mounted ? width : 0;
  // On web, pad the tab items inward so they stay in the same content column
  // as the rest of the page — full-width ink background is handled by tabBg.
  const tabHPad = Platform.OS === 'web' ? Math.max(0, (effectiveWidth - CONTENT_MAX_WIDTH) / 2) : Spacing[5];

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: [
          styles.tabBar,
          {
            // Floating island: fixed compact height, lifted off the bottom
            // edge (and the home indicator) by FLOAT_MARGIN + the safe area,
            // instead of stretching edge-to-edge and padding its own bottom.
            height:       TAB_BAR_HEIGHT,
            bottom:       insets.bottom + FLOAT_MARGIN,
            left:         insets.left + tabHPad + FLOAT_MARGIN,
            right:        insets.right + tabHPad + FLOAT_MARGIN,
            paddingTop:    TAB_BAR_TOP_PAD,
            // Explicit, equal to paddingTop — without this, react-navigation's
            // own safe-area handling still pads the bottom by default (meant
            // for a bar docked flush to the screen edge), which now double-
            // counts against the floating `bottom` offset above and pushes
            // the icons off-center toward the top of the pill.
            paddingBottom: TAB_BAR_TOP_PAD,
          },
        ],
        // Liquid glass: real blur of whatever's scrolling behind the bar
        // (same recipe ProductModal already uses), an ink tint over it for
        // legibility/brand color, and a bright hairline along the top edge
        // to fake light catching the glass.
        tabBarBackground: () => (
          <View style={styles.tabBg}>
            <BlurView intensity={45} tint="dark" style={StyleSheet.absoluteFillObject} />
            <View style={styles.tabGlassTint} />
            <View style={styles.tabGlassHighlight} />
          </View>
        ),
        tabBarActiveTintColor:   Colors.accentLime,
        tabBarInactiveTintColor: 'rgba(255,255,255,0.55)',
        tabBarLabelStyle: styles.label,
        tabBarShowLabel: true,
      }}
    >
      <Tabs.Screen
        name="feed"
        options={{
          title: 'feed',
          tabBarIcon: ({ color, size }) => <GridIcon color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="boards"
        options={{
          title: 'boards',
          tabBarIcon: ({ color, size }) => <BoardsIcon color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'search',
          tabBarIcon: ({ color, size }) => <SearchIcon color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'profile',
          tabBarIcon: ({ color, size }) => <ProfileIcon color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position:        'absolute',
    borderRadius:    Radius.nav,
    backgroundColor: 'transparent',
    ...Shadows.elevated,
  },
  tabBg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: Radius.nav,
    overflow:     'hidden', // clips the blur + tint to the pill's rounded corners
  },
  tabGlassTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(13,16,53,0.55)', // Colors.ink, translucent over the blur
  },
  tabGlassHighlight: {
    position:        'absolute',
    top: 0, left: 0, right: 0,
    height:          1,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  label: {
    ...Typography.caption,
    fontSize:  10,
    marginTop: -2,
  },
});
