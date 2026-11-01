import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut, FadeInLeft, FadeInRight, ReduceMotion, useReducedMotion } from 'react-native-reanimated';
import { ONBOARDING_STEPS, type OnboardingStep } from '@/data/products';
import { useAuthStore } from '@/store/useAuthStore';
import { Colors, Radius, Typography, Spacing, Animation } from '@/lib/theme';
import * as haptics from '@/lib/haptics';
import { WebFrame } from '@/components/WebFrame';
import { StepHeader } from '@/components/onboarding/StepHeader';
import { NeverShowStep } from '@/components/onboarding/NeverShowStep';
import { ImagePicksStep } from '@/components/onboarding/ImagePicksStep';
import { Reveal } from '@/components/onboarding/Reveal';

// Everything the user answers, kept whole so #25 can persist all of it.
// Today only the positive signals reach the profile; see toTasteProfile().
type Selections = {
  neverShow: { styles: string[]; categories: string[] };
  imageAnswers: Record<string, boolean>; // product id → yes/no
};

const EMPTY: Selections = { neverShow: { styles: [], categories: [] }, imageAnswers: {} };

// The current profile columns only take positive brands/styles/categories, so
// they're derived from the "yes" image picks, minus anything never-shown.
// Never-show and the "no" answers are dropped until #25 adds a place for them.
function toTasteProfile({ neverShow, imageAnswers }: Selections) {
  const liked = imageProducts().filter(p => imageAnswers[p.id]);
  const styles = new Set(liked.flatMap(p => p.styles));
  const categories = new Set(liked.map(p => p.category));
  neverShow.styles.forEach(s => styles.delete(s));
  neverShow.categories.forEach(c => categories.delete(c));
  return { brands: [], styles: [...styles], categories: [...categories] };
}

function imageProducts() {
  const step = ONBOARDING_STEPS.find(s => s.key === 'imagePicks');
  return step?.key === 'imagePicks' ? step.products : [];
}

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { completeOnboarding } = useAuthStore();
  const [stepIndex, setStepIndex] = useState(0);
  const [imageIndex, setImageIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [selections, setSelections] = useState<Selections>(EMPTY);
  const [revealing, setRevealing] = useState(false);
  const saving = useRef<Promise<void> | undefined>(undefined);

  // Warm the image-pick photos while the earlier steps are answered.
  useEffect(() => { Image.prefetch(imageProducts().map(p => p.image)); }, []);

  const step: OnboardingStep = ONBOARDING_STEPS[stepIndex];
  const within = step.key === 'imagePicks' ? imageIndex / step.products.length : 0;
  const progress = revealing ? 1 : (stepIndex + within) / ONBOARDING_STEPS.length;
  const canGoBack = stepIndex > 0 || (step.key === 'imagePicks' && imageIndex > 0);

  function goTo(index: number) {
    setDirection(index > stepIndex ? 1 : -1);
    setStepIndex(index);
  }

  function next() {
    if (stepIndex < ONBOARDING_STEPS.length - 1) { goTo(stepIndex + 1); return; }
    finish(selections);
  }

  // Write while the reveal plays; the feed waits for it so index.tsx's
  // onboarding_completed_at check doesn't bounce the user back here.
  function finish(final: Selections) {
    saving.current = completeOnboarding(toTasteProfile(final));
    setRevealing(true);
  }

  function back() {
    if (step.key === 'imagePicks' && imageIndex > 0) { setImageIndex(i => i - 1); return; }
    goTo(stepIndex - 1);
  }

  function toggleNeverShow(field: keyof Selections['neverShow'], id: string) {
    haptics.onboardingSelect();
    setSelections(prev => {
      const list = prev.neverShow[field];
      const nextList = list.includes(id) ? list.filter(x => x !== id) : [...list, id];
      return { ...prev, neverShow: { ...prev.neverShow, [field]: nextList } };
    });
  }

  function answerImage(yes: boolean) {
    if (step.key !== 'imagePicks') return;
    haptics.onboardingSelect();
    const product = step.products[imageIndex];
    const imageAnswers = { ...selections.imageAnswers, [product.id]: yes };
    setSelections(prev => ({ ...prev, imageAnswers }));
    if (imageIndex < step.products.length - 1) { setImageIndex(i => i + 1); return; }
    if (stepIndex < ONBOARDING_STEPS.length - 1) { goTo(stepIndex + 1); return; }
    finish({ ...selections, imageAnswers });
  }

  async function enterFeed() {
    await saving.current;
    router.replace('/(tabs)/feed');
  }

  // Steps that confirm with Continue; image picks advance on each answer.
  const showContinue = step.key === 'neverShow';

  const entering = reduceMotion
    ? FadeIn.duration(Animation.standard).reduceMotion(ReduceMotion.Never)
    : (direction === 1 ? FadeInRight : FadeInLeft).duration(Animation.standard);
  const exiting = FadeOut.duration(Animation.micro).reduceMotion(ReduceMotion.Never);

  return (
    <WebFrame maxWidth={480}>
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StepHeader
        number={stepIndex + 1}
        title={step.title}
        subtitle={step.subtitle}
        progress={progress}
        onBack={canGoBack && !revealing ? back : undefined}
      />

      <Animated.View key={step.key} entering={entering} exiting={exiting} style={styles.body}>
        {step.key === 'neverShow' && (
          <NeverShowStep step={step} excluded={selections.neverShow} onToggle={toggleNeverShow} />
        )}
        {step.key === 'imagePicks' && (
          <ImagePicksStep
            products={step.products}
            index={imageIndex}
            answers={selections.imageAnswers}
            onAnswer={answerImage}
            bottomInset={insets.bottom}
          />
        )}
      </Animated.View>

      {showContinue && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable style={styles.continueBtn} onPress={next} accessibilityRole="button">
            <Text style={styles.continueText}>continue</Text>
          </Pressable>
        </View>
      )}

      {revealing && <Reveal onDone={enterFeed} />}
    </View>
    </WebFrame>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: Colors.bg },
  body:    { flex: 1 },
  footer:  { paddingHorizontal: Spacing.screen, paddingTop: 14, borderTopWidth: 1, borderTopColor: Colors.border },
  // Coral is the primary action color — onboarding "continue" is the most important tap in the whole app
  continueBtn:  { backgroundColor: Colors.accent, borderRadius: Radius.full, paddingVertical: 17, alignItems: 'center' },
  continueText: { ...Typography.cardTitle, color: Colors.text },
});
