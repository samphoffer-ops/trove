import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '@/lib/theme';

export default function NotFound() {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Page not found</Text>
      <Pressable onPress={() => router.replace('/(tabs)/feed')}>
        <Text style={styles.link}>Go home</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root:  { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF8F0' },
  title: { fontSize: 18, fontWeight: '600', color: '#0B0C1D', marginBottom: 12 },
  link:  { fontSize: 15, color: '#FF4A1C', fontWeight: '600' },
});
