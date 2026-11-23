import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { CitationCard } from '../../../src/components/CitationCard';
import { Panel } from '../../../src/components/Panel';
import { PaywallCard } from '../../../src/components/PaywallCard';
import { Screen } from '../../../src/components/Screen';
import { useBundle } from '../../../src/content/useBundle';
import { jurisdictionById } from '../../../src/content/jurisdictions';
import { useSettings } from '../../../src/store/settings';
import { usePremium } from '../../../src/store/premium';
import { isQuestionForJurisdiction } from '../../../src/logic/access';
import type { JurisdictionId } from '../../../src/types';

export default function RegionalFocus() {
  const { t } = useTranslation(); const router = useRouter(); const theme = useTheme(); const bundle = useBundle(); const id = useSettings((s) => s.jurisdictionId) ?? 'ON'; const premium = usePremium((s) => s.unlocked); const j = jurisdictionById(id as JurisdictionId);
  const regionalLessons = bundle.lessons.map((lesson) => ({ lesson, ids: lesson.questionIds.filter((qid) => { const q = bundle.questions[qid]; return q?.regional === true && isQuestionForJurisdiction(q, id as JurisdictionId); }) })).filter((x) => x.ids.length > 0);
  return <Screen><Stack.Screen options={{ title: t('regional.title') }} /><Panel tone='primary'><Text variant='headlineSmall' style={{ color: theme.colors.onPrimary, fontWeight: '700' }}>{j.nameEn === j.nameFr ? j.nameEn : `${j.nameFr} / ${j.nameEn}`}</Text><Text style={{ color: theme.colors.onPrimary }}>{t('regional.subtitle')}</Text></Panel><Panel><Text variant='titleMedium'>{j.kind === 'territory' ? t('onboarding.territory') : t('onboarding.province')}</Text><Text variant='bodyMedium'>{j.capitalEn === j.capitalFr ? j.capitalEn : `${j.capitalFr} / ${j.capitalEn}`}</Text></Panel>{!premium ? <PaywallCard compact /> : null}<View style={styles.list}>{regionalLessons.map(({ lesson, ids }) => <Panel key={lesson.id} onPress={() => premium ? router.push(`/learn/lesson/${lesson.id}`) : router.push('/premium')}><View style={styles.row}><View style={styles.grow}><Text variant='labelSmall'>{t('lessonUi.lessonLabel', { n: lesson.order })}</Text><Text variant='titleMedium'>{lesson.title}</Text><Text variant='bodySmall'>{t('regional.questions', { count: ids.length })}</Text></View><Text style={styles.arrow}>›</Text></View></Panel>)}</View>{regionalLessons.length > 0 ? <CitationCard source={regionalLessons[0].lesson.source!} /> : <Panel><Text>{t('regional.noQuestions')}</Text></Panel>}</Screen>;
}
const styles = StyleSheet.create({ list: { gap: 12 }, row: { flexDirection: 'row', alignItems: 'center', gap: 12 }, grow: { flex: 1, gap: 4 }, arrow: { fontSize: 30 } });
