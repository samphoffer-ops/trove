import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProductDetailContent } from '@/components/ProductDetailContent';
import { WebFrame } from '@/components/WebFrame';

export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  return (
    <WebFrame maxWidth={480}>
      <ProductDetailContent productId={id!} topInset={insets.top} bottomInset={insets.bottom} />
    </WebFrame>
  );
}
