import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';
import { Colors, Typography } from '@/lib/theme';

// System tab bar (UITabBarController via react-native-screens), so iOS 26+
// renders the real Liquid Glass bar. Deliberately no backgroundColor,
// blurEffect or shadow: any of those replaces the system glass appearance.
//
// Feed, Boards, and Search (#63, back in 1.0 on 2026-11-14 over spec §3).
// Search takes the system search role, so iOS 26+ draws it as the separate
// round search button at the end of the bar and supplies its own icon and
// localized title. Profile and settings are reached from the header
// (GlassHeader).
export default function TabsLayout() {
  return (
    <NativeTabs
      tintColor={Colors.text}
      labelStyle={{ fontFamily: Typography.label.fontFamily, fontSize: Typography.label.fontSize }}
    >
      <NativeTabs.Trigger name="feed">
        <Icon sf={{ default: 'square.grid.2x2', selected: 'square.grid.2x2.fill' }} />
        <Label>Feed</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="boards">
        <Icon sf={{ default: 'rectangle.stack', selected: 'rectangle.stack.fill' }} />
        <Label>Boards</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="search" role="search" />
    </NativeTabs>
  );
}
