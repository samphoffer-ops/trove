import { Stack } from 'expo-router';
import { WebFrame } from '@/components/WebFrame';

export default function AuthLayout() {
  return (
    <WebFrame maxWidth={480}>
      <Stack screenOptions={{ headerShown: false }} />
    </WebFrame>
  );
}
