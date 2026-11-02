import { useState } from 'react';
import { Platform } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProductDetailContent } from '@/components/ProductDetailContent';
import { WebFrame } from '@/components/WebFrame';
import { takePendingSource } from '@/lib/sharedTransition';

// Presented as a transparent modal with no native animation (app/_layout.tsx):
// ProductDetailContent animates itself out of the card that opened it and
// back into it on dismiss, then this pops the route.
export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [source] = useState(() => takePendingSource(id!));

  function onDismissed() {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/feed');
  }

  return (
    <WebFrame maxWidth={480}>
      <ProductDetailContent
        productId={id!}
        topInset={insets.top}
        bottomInset={insets.bottom}
        source={source}
        onDismissed={Platform.OS === 'web' ? undefined : onDismissed}
      />
    </WebFrame>
  );
}
