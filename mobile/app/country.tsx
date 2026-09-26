import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing } from '@/lib/theme';
import { ChevronLeftIcon, CheckIcon } from '@/components/Icons';
import { WebFrame } from '@/components/WebFrame';
import { goBack } from '@/lib/navigation';
import { notify } from '@/lib/alerts';
import { COUNTRIES } from '@/lib/currency';
import { useCountry, useCurrencyStore } from '@/store/useCurrencyStore';

// Country picker — sets which currency every price in the app shows in.
export default function CountryScreen() {
  const insets = useSafeAreaInsets();
  const current = useCountry();
  const setCountry = useCurrencyStore(s => s.setCountry);

  async function choose(code: string) {
    const { error } = await setCountry(code);
    if (error) notify('Couldn\'t save your country', error);
    else goBack('/settings');
  }

  return (
    <WebFrame maxWidth={960}>
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => goBack('/settings')} hitSlop={8}>
          <ChevronLeftIcon />
        </Pressable>
        <Text style={styles.topBarTitle}>Country</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          Prices show in your country's currency — the brand's own local price when it has one,
          otherwise converted at today's rate.
        </Text>
        {COUNTRIES.map(c => {
          const selected = c.code === current.code;
          return (
            <Pressable key={c.code} style={styles.row} onPress={() => choose(c.code)}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, selected && styles.nameSelected]}>{c.name}</Text>
                <Text style={styles.currency}>{c.currency}</Text>
              </View>
              {selected && (
                <View style={styles.check}>
                  <CheckIcon color={Colors.bg} size={11} />
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
    </WebFrame>
  );
}

const styles = StyleSheet.create({
  root:         { flex: 1, backgroundColor: Colors.bg },
  topBar:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  topBarTitle:  { ...Typography.cardTitle, fontSize: 16, color: Colors.text },
  content:      { paddingHorizontal: 20, paddingBottom: 100 },
  intro:        { ...Typography.caption, color: Colors.textMuted, lineHeight: 18, marginBottom: Spacing[4] },
  row:          { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing[3], borderBottomWidth: 1, borderBottomColor: Colors.border },
  name:         { ...Typography.body, fontSize: 15, color: Colors.text },
  nameSelected: { fontWeight: '700' },
  currency:     { ...Typography.caption, color: Colors.textMuted, marginTop: 2 },
  check:        { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.text, alignItems: 'center', justifyContent: 'center' },
});
