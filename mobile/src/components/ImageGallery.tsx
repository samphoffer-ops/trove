import { useRef, useState } from 'react';
import { View, StyleSheet, useWindowDimensions, NativeSyntheticEvent, NativeScrollEvent, LayoutChangeEvent } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { Image } from 'expo-image';
import { Colors } from '@/lib/theme';

interface Props {
  images:      string[];     // at least 1; first is always the hero
  maxHeight?:  number;       // caps the gallery height (for modal context)
  aspectRatio?: number;      // overrides the default 3:4 (e.g. masonry cards use a per-product ratio)
}

// Simple horizontal-pager gallery. Works with a single image (dots hidden,
// no swipe chrome) — so ProductDetailContent doesn't need to branch.
//
// Uses onLayout (not useWindowDimensions) for page width — on web the window
// can be 1200px wide while the modal is only 460px, so useWindowDimensions
// would make every image page 1200px wide and pagingEnabled would scroll
// by 1200px at a time. onLayout always reflects the actual rendered size.
export function ImageGallery({ images, maxHeight, aspectRatio }: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);

  // Deduplicate: scraper sometimes includes the hero twice
  const unique = Array.from(new Set(images.filter(Boolean)));
  const multi  = unique.length > 1;

  const pageWidth = containerWidth || windowWidth;

  // Single image (the common case, most products) skips the ScrollView
  // entirely — an unvirtualized masonry grid mounts every card at once, and
  // a gesture-handler ScrollView per card (for swiping) is real native
  // overhead multiplied across the whole feed. Only pay for it when a
  // product actually has extra photos to swipe through.
  if (!multi) {
    return (
      <View style={styles.root}>
        <Image
          source={{ uri: unique[0] }}
          style={[
            styles.img,
            aspectRatio ? { aspectRatio } : undefined,
            maxHeight ? { height: maxHeight } : undefined,
          ]}
          contentFit="cover"
        />
      </View>
    );
  }

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
              style={[
                styles.img,
                aspectRatio ? { aspectRatio } : undefined,
                maxHeight ? { height: maxHeight } : undefined,
              ]}
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
