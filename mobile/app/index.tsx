import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '@/store/useAuthStore';
import { Colors } from '@/lib/theme';

export default function Index() {
  const { session, loading, profile, profileLoading } = useAuthStore();

  if (loading || (session && profileLoading)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg }}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  if (!session) return <Redirect href="/(auth)/sign-in" />;
  if (!profile?.onboarding_completed_at) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)/feed" />;
}
