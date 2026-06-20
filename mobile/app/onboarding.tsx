import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, FlatList } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ONBOARDING_STEPS } from '@/data/products';
import { useAuthStore } from '@/store/useAuthStore';
import { Colors, Radius } from '@/lib/theme';
import { ChevronLeftIcon, CheckIcon } from '@/components/Icons';
import { WebFrame } from '@/components/WebFrame';

type Selections = { brands: string[]; styles: string[]; categories: string[] };

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const { completeOnboarding } = useAuthStore();
  const [stepIndex, setStepIndex] = useState(0);
  const [selections, setSelections] = useState<Selections>({ brands: [], styles: [], categories: [] });
  const [submitting, setSubmitting] = useState(false);

  const step = ONBOARDING_STEPS[stepIndex];
  const field = step.key as keyof Selections;
  const selected = selections[field];
  const isLastStep = stepIndex === ONBOARDING_STEPS.length - 1;

  function toggle(id: string) {
    setSelections(prev => {
      const list = prev[field];
      const next = list.includes(id) ? list.filter(x => x !== id) : [...list, id];
      return { ...prev, [field]: next };
    });
  }

  async function advance() {
    if (!isLastStep) { setStepIndex(i => i + 1); return; }
    setSubmitting(true);
    await completeOnboarding(selections);
    router.replace('/(tabs)/feed');
  }

  async function skipAll() {
    setSubmitting(true);
    await completeOnboarding({ brands: [], styles: [], categories: [] });
    router.replace('/(tabs)/feed');
  }

  return (
    <WebFrame maxWidth={480}>
    <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
      <View style={styles.topBar}>
        {stepIndex > 0 ? (
          <Pressable onPress={() => setStepIndex(i => i - 1)} hitSlop={8}>
            <ChevronLeftIcon />
          </Pressable>
        ) : (
          <View style={{ width: 22 }} />
        )}
        <View style={styles.dots}>
          {ONBOARDING_STEPS.map((_, i) => (
            <View key={i} style={[styles.dot, i === stepIndex && styles.dotActive]} />
          ))}
        </View>
        <Pressable onPress={skipAll} hitSlop={8}>
          <Text style={styles.skipText}>skip</Text>
        </Pressable>
      </View>

      <Text style={styles.title}>{step.title}</Text>
      <Text style={styles.subtitle}>{step.subtitle}</Text>

      <FlatList
        key={step.key}
        data={step.options}
        keyExtractor={o => o.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const active = selected.includes(item.id);
          return (
            <Pressable style={styles.tile} onPress={() => toggle(item.id)}>
              <Image source={{ uri: item.img }} style={StyleSheet.absoluteFill} contentFit="cover" />
              <View style={[styles.tileOverlay, active && styles.tileOverlayActive]} />
              {active && (
                <View style={styles.checkBadge}>
                  <CheckIcon color={Colors.text} />
                </View>
              )}
              <View style={styles.tileLabelWrap}>
                <Text style={styles.tileLabel}>{item.label}</Text>
              </View>
            </Pressable>
          );
        }}
      />

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          style={[styles.continueBtn, (selected.length === 0 || submitting) && styles.continueBtnDisabled]}
          onPress={advance}
          disabled={selected.length === 0 || submitting}
        >
          <Text style={styles.continueText}>{isLastStep ? 'start exploring' : 'continue'}</Text>
        </Pressable>
      </View>
    </View>
    </WebFrame>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: Colors.bg },
  topBar:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 8 },
  dots:    { flexDirection: 'row', gap: 6 },
  dot:     { width: 7, height: 7, borderRadius: 3.5, backgroundColor: Colors.border },
  dotActive: { backgroundColor: Colors.accent, width: 18 },
  skipText: { fontSize: 14, fontWeight: '600', color: Colors.textMuted },
  title:    { fontSize: 24, fontWeight: '800', color: Colors.text, letterSpacing: -0.4, paddingHorizontal: 20, marginTop: 12 },
  subtitle: { fontSize: 14.5, color: Colors.textMuted, paddingHorizontal: 20, marginTop: 4, marginBottom: 16 },
  grid:     { paddingHorizontal: 16, paddingBottom: 16 },
  row:      { gap: 12 },
  tile:     {
    flex: 1, aspectRatio: 1, borderRadius: Radius.md, overflow: 'hidden',
    backgroundColor: Colors.stoneSoft, marginBottom: 12, justifyContent: 'flex-end',
  },
  tileOverlay:       { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(11,12,29,0.18)' },
  tileOverlayActive: { backgroundColor: 'rgba(232,243,83,0.4)' },
  checkBadge: {
    position: 'absolute', top: 10, right: 10, width: 24, height: 24, borderRadius: 12,
    backgroundColor: Colors.accentLime, alignItems: 'center', justifyContent: 'center',
  },
  tileLabelWrap: { padding: 10 },
  tileLabel:     { fontSize: 14, fontWeight: '700', color: '#fff' },
  footer:  { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  continueBtn:        { backgroundColor: Colors.accentLime, borderRadius: Radius.full, paddingVertical: 16, alignItems: 'center' },
  continueBtnDisabled:{ opacity: 0.35 },
  continueText:       { color: Colors.text, fontSize: 16, fontWeight: '700' },
});
