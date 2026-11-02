import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, LayoutChangeEvent } from 'react-native';
import { Image } from 'expo-image';
import Animated, { FadeIn, FadeOut, FadeInRight, FadeOutLeft, ReduceMotion, useReducedMotion } from 'react-native-reanimated';
import type { OnboardingPick } from '@/data/products';
import { Colors, Radius, Typography, Spacing, Animation } from '@/lib/theme';

type Props = {
  products: OnboardingPick[];
  index: number;
  answers: Record<string, boolean>;
  onAnswer: (yes: boolean) => void;
  bottomInset: number;
};

// One product at a time, uncropped: the frame takes the catalog's stored ratio
// and the image is fit inside it, never cropped (product images stay exactly
// as scraped). Answering advances; the yes/no pair sits in the thumb zone.
export function ImagePicksStep({ products, index, answers, onAnswer, bottomInset }: Props) {
  const reduceMotion = useReducedMotion();
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const product = products[index];

  function onStageLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    setStage({ w: width, h: height });
  }

  // Fit width first, then shrink if the stored ratio is taller than the stage.
  const frameW = Math.min(stage.w, stage.h / product.ratio);
  const frameH = frameW * product.ratio;

  const entering = reduceMotion
    ? FadeIn.duration(Animation.standard).reduceMotion(ReduceMotion.Never)
    : FadeInRight.duration(Animation.standard);
  const exiting = reduceMotion
    ? FadeOut.duration(Animation.micro).reduceMotion(ReduceMotion.Never)
    : FadeOutLeft.duration(Animation.micro);

  const previous = answers[product.id];

  return (
    <View style={[styles.root, { paddingBottom: bottomInset + Spacing[4] }]}>
      <View style={styles.stage} onLayout={onStageLayout}>
        {stage.w > 0 && (
          <Animated.View key={product.id} entering={entering} exiting={exiting} style={{ width: frameW, height: frameH }}>
            <Image
              source={{ uri: product.image }}
              style={StyleSheet.absoluteFill}
              contentFit="contain"
              transition={Animation.standard}
              accessibilityLabel={`${product.name} by ${product.brand}`}
            />
          </Animated.View>
        )}
      </View>

      <View style={styles.meta}>
        <View style={styles.metaText}>
          <Text style={styles.brand} numberOfLines={1}>{product.brand}</Text>
          <Text style={styles.name} numberOfLines={1}>{product.name}</Text>
        </View>
        <Text style={styles.counter} accessibilityLabel={`${index + 1} of ${products.length}`}>
          {String(index + 1).padStart(2, '0')}
          <Text style={styles.counterTotal}> / {products.length}</Text>
        </Text>
      </View>

      <View style={styles.answers}>
        <AnswerButton label="No" selected={previous === false} onPress={() => onAnswer(false)} hint={`Not for me: ${product.name}`} />
        <AnswerButton label="Yes" selected={previous === true} onPress={() => onAnswer(true)} hint={`More like ${product.name}`} yes />
      </View>
    </View>
  );
}

function AnswerButton({ label, hint, selected, yes, onPress }: {
  label: string; hint: string; selected: boolean; yes?: boolean; onPress: () => void;
}) {
  const activeStyle = yes ? styles.answerYes : styles.answerNo;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.answer, (pressed || selected) && activeStyle]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ selected }}
    >
      {({ pressed }) => (
        <Text style={[styles.answerText, !yes && (pressed || selected) && styles.answerTextOnInk]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, paddingHorizontal: Spacing.screen },
  stage:   { flex: 1, alignItems: 'flex-start', justifyContent: 'flex-end' },
  meta:    { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing[4], marginTop: Spacing[4], marginBottom: Spacing[5] },
  metaText:{ flex: 1 },
  brand:   { ...Typography.label, color: Colors.accentBlue },
  name:    { ...Typography.caption, color: Colors.textMuted, marginTop: 2 },
  counter: { ...Typography.headline, color: Colors.text, fontVariant: ['tabular-nums'] },
  counterTotal: { ...Typography.caption, color: Colors.textMuted },
  answers: { flexDirection: 'row', gap: Spacing[4] },
  answer: {
    flex: 1, paddingVertical: 17, alignItems: 'center',
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.borderStrong,
  },
  // Chartreuse is the selected state; "no" fills ink, matching never-show.
  answerYes:       { backgroundColor: Colors.accentLime, borderColor: Colors.accentLime },
  answerNo:        { backgroundColor: Colors.ink, borderColor: Colors.ink },
  answerText:      { ...Typography.cardTitle, color: Colors.text },
  answerTextOnInk: { color: Colors.bg },
});
