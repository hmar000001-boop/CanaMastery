import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';
import { NativePickerRow } from '../src/components/NativePickerRow';
import { Screen } from '../src/components/Screen';
import { deviceLang } from '../src/i18n';
import { JURISDICTIONS } from '../src/content/jurisdictions';
import { useSettings } from '../src/store/settings';
import type { JurisdictionId, Lang } from '../src/types';

const GOALS = [10, 20, 30, 45];
export default function Onboarding() {
  const { t, i18n } = useTranslation(); const router = useRouter(); const theme = useTheme(); const complete = useSettings((s) => s.completeOnboarding);
  const [lang, setLang] = useState<Lang>(deviceLang()); const [jurisdictionId, setJurisdictionId] = useState<JurisdictionId | null>(null); const [date, setDate] = useState<string | null>(null); const [goal, setGoal] = useState(20);
  const pickLang = (value: Lang) => { setLang(value); void i18n.changeLanguage(value); };
  const start = () => { if (!jurisdictionId) return; complete({ lang, jurisdictionId, examDate: date, dailyGoalMin: goal }); router.replace('/'); };
  return <Screen>
    <ScrollView contentContainerStyle={styles.content}>
      <Text variant='headlineMedium'>{t('onboarding.title')}</Text><Text variant='bodyLarge'>{t('onboarding.subtitle')}</Text>
      <Text variant='titleMedium'>{t('onboarding.language')}</Text>
      <View style={styles.row}><Button mode={lang === 'fr' ? 'contained' : 'outlined'} onPress={() => pickLang('fr')}>{t('onboarding.languageFrench')}</Button><Button mode={lang === 'en' ? 'contained' : 'outlined'} onPress={() => pickLang('en')}>{t('onboarding.languageEnglish')}</Button></View>
      <Text variant='titleMedium'>{t('onboarding.jurisdiction')}</Text>
      <Text variant='bodySmall' style={{ color: theme.colors.onSurfaceVariant }}>{t('onboarding.jurisdictionHint')}</Text>
      <View style={styles.grid}>{JURISDICTIONS.map((item) => { const selected = jurisdictionId === item.id; const name = lang === 'fr' ? item.nameFr : item.nameEn; return <Button key={item.id} mode={selected ? 'contained' : 'outlined'} onPress={() => setJurisdictionId(item.id)} style={styles.jurisdiction}>{name}</Button>; })}</View>
      <NativePickerRow mode='date' value={date} label={t('onboarding.examDate')} onValueChange={setDate} />
      <Text variant='bodySmall'>{t('settingsUx.dateHint')}</Text>
      {date ? <Button mode='text' onPress={() => setDate(null)}>{t('settingsUx.clearDate')}</Button> : null}
      <Text variant='titleMedium'>{t('onboarding.dailyGoal')}</Text>
      <View style={styles.row}>{GOALS.map((minutes) => <Button key={minutes} mode={goal === minutes ? 'contained' : 'outlined'} onPress={() => setGoal(minutes)}>{t('onboarding.minutes', { count: minutes })}</Button>)}</View>
      <Button disabled={!jurisdictionId} mode='contained' onPress={start}>{t('onboarding.start')}</Button>
    </ScrollView>
  </Screen>;
}
const styles = StyleSheet.create({ content: { gap: 12, paddingBottom: 24 }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, jurisdiction: { maxWidth: '100%' } });
