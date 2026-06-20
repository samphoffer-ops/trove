import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { Colors } from '@/lib/theme';
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
          <BlurView intensity={70} tint="light" style={styles.blur} />
        ),
        tabBarActiveTintColor:   Colors.text,
        tabBarInactiveTintColor: Colors.textMuted,
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
    left:            16,
    right:           16,
    bottom:          14,
    height:          60,
    borderRadius:    999,
    backgroundColor: 'transparent',
    borderTopWidth:  0,
    borderWidth:     1,
    borderColor:     'rgba(255,255,255,0.5)',
    elevation:       0,
    shadowColor:     '#1E1C1A',
    shadowOffset:    { width: 0, height: 6 },
    shadowOpacity:   0.1,
    shadowRadius:    18,
    overflow:        'hidden',
  },
  blur: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  label: {
    fontSize:   10.5,
    fontWeight: '600',
    marginTop:  -2,
  },
});
