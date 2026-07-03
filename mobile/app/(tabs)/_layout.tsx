import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { Colors, Typography } from '@/lib/theme';
import { GridIcon, BoardsIcon, SearchIcon, ProfileIcon } from '@/components/Icons';
import { WebFrame } from '@/components/WebFrame';

export default function TabsLayout() {
  return (
    <WebFrame>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarBackground: () => (
          <BlurView intensity={95} tint="dark" style={styles.blur} />
        ),
        tabBarActiveTintColor:   Colors.accentLime,
        tabBarInactiveTintColor: 'rgba(255,255,255,0.42)',
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
    </WebFrame>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position:        'absolute',
    left:            20,
    right:           20,
    bottom:          18,
    height:          62,
    borderRadius:    999,
    backgroundColor: 'transparent',
    borderTopWidth:  0,
    // A faint border against the page content below
    borderWidth:     1,
    borderColor:     'rgba(255,255,255,0.10)',
    elevation:       0,
    shadowColor:     '#0D1035',
    shadowOffset:    { width: 0, height: 10 },
    shadowOpacity:   0.28,
    shadowRadius:    24,
    overflow:        'hidden',
  },
  blur: {
    ...StyleSheet.absoluteFillObject,
    // Tint the blur layer slightly toward inky black
    backgroundColor: 'rgba(13,16,53,0.70)',
  },
  label: {
    ...Typography.caption,
    fontSize:  10,
    marginTop: -2,
  },
});
