import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Colors, Typography, Spacing } from '@/lib/theme';

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
  root:  { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg },
  title: { ...Typography.headline, fontSize: 18, color: Colors.text, marginBottom: Spacing[3] },
  link:  { ...Typography.cardTitle, fontSize: 15, color: Colors.accent },
});
