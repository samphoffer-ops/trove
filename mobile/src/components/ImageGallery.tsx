import { useRef, useState } from 'react';
import { View, ScrollView, StyleSheet, useWindowDimensions, NativeSyntheticEvent, NativeScrollEvent, LayoutChangeEvent } from 'react-native';
import { Image } from 'expo-image';
import { Colors } from '@/lib/theme';

interface Props {
  images:    string[];     // at least 1; first is always the hero
  maxHeight?: number;      // caps the gallery height (for modal context)
}

// Simple horizontal-pager gallery. Works with a single image (dots hidden,
// no swipe chrome) — so ProductDetailContent doesn't need to branch.
//
// Uses onLayout (not useWindowDimensions) for page width — on web the window
// can be 1200px wide while the modal is only 460px, so useWindowDimensions
// would make every image page 1200px wide and pagingEnabled would scroll
// by 1200px at a time. onLayout always reflects the actual rendered size.
export function ImageGallery({ images, maxHeight }: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);

  // Deduplicate: scraper sometimes includes the hero twice
  const unique = Array.from(new Set(images.filter(Boolean)));
  const multi  = unique.length > 1;

  const pageWidth = containerWidth || windowWidth;

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!multi) return;
    const idx = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
    setActiveIndex(idx);
  }

  function onLayout(e: LayoutChangeEvent) {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setContainerWidth(w);
  }

  return (
    <View style={styles.root} onLayout={onLayout}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        scrollEnabled={multi}
        style={{ maxHeight }}
      >
        {unique.map((uri, i) => (
          <View key={i} style={[styles.page, { width: pageWidth }]}>
            <Image
              source={{ uri }}
              style={[styles.img, maxHeight ? { height: maxHeight } : undefined]}
              contentFit="cover"
            />
          </View>
        ))}
      </ScrollView>

      {/* Dot indicators — hidden when there's only one image */}
      {multi && (
        <View style={styles.dots}>
          {unique.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === activeIndex && styles.dotActive,
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%', backgroundColor: Colors.stoneSoft },
  page: { overflow: 'hidden' },
  img:  { width: '100%', aspectRatio: 3 / 4, backgroundColor: Colors.stoneSoft },
  dots: {
    position:       'absolute',
    bottom:         12,
    left:           0,
    right:          0,
    flexDirection:  'row',
    justifyContent: 'center',
    gap:            6,
  },
  dot: {
    width:           6,
    height:          6,
    borderRadius:    3,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  dotActive: {
    backgroundColor: '#fff',
    width:           16,
    borderRadius:    3,
  },
});
