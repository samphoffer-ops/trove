import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Colors, Typography } from '@/lib/theme';
import { GridIcon, BoardsIcon, SearchIcon, ProfileIcon } from '@/components/Icons';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarBackground: () => <View style={styles.tabBg} />,
        tabBarActiveTintColor:   Colors.accentLime,
        tabBarInactiveTintColor: 'rgba(255,255,255,0.35)',
        tabBarLabelStyle: styles.label,
        tabBarShowLabel: true,
      }}
    >
      <Tabs.Screen
        name="feed"
        options={{
          title: 'feed',
          tabBarIcon: ({ color }) => <GridIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="boards"
        options={{
          title: 'boards',
          tabBarIcon: ({ color }) => <BoardsIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'search',
          tabBarIcon: ({ color }) => <SearchIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'profile',
          tabBarIcon: ({ color }) => <ProfileIcon color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position:        'absolute',
    left:            0,
    right:           0,
    bottom:          0,
    height:          58,
    borderTopWidth:  0.5,
    borderTopColor:  'rgba(255,255,255,0.10)',
    backgroundColor: 'transparent',
    elevation:       0,
  },
  tabBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.ink,
  },
  label: {
    ...Typography.caption,
    fontSize:  10,
    marginTop: -2,
  },
});
