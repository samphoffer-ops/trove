import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '@/store/useAuthStore';
import { Colors } from '@/lib/theme';

export default function Index() {
  const { session, loading } = useAuthStore();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg }}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  if (session) return <Redirect href="/(tabs)/feed" />;
  return <Redirect href="/(auth)/sign-in" />;
}
