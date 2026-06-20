import { Stack } from 'expo-router';
import { WebFrame } from '@/components/WebFrame';

export default function AuthLayout() {
  return (
    <WebFrame>
      <Stack screenOptions={{ headerShown: false }} />
    </WebFrame>
  );
}
