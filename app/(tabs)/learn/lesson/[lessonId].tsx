import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';
import { CitationCard } from '../../../../src/components/CitationCard';
import { DefinitionSheet } from '../../../../src/components/DefinitionSheet';
import { PaywallCard } from '../../../../src/components/PaywallCard';
import { RichText } from '../../../../src/components/RichText';
import { useBundle } from '../../../../src/content/useBundle';
import { useCompletionText } from '../../../../src/i18n/completion';
import { learningLessonQuizIds, lessonStatus } from '../../../../src/logic/completion';
import { isQuestionForJurisdiction } from '../../../../src/logic/access';
import { learningPassPercent } from '../../../../src/logic/learningLevels';
import { makeGlossaryMatcher } from '../../../../src/logic/glossary';
import { useProgress } from '../../../../src/store/progress';
import { usePremium } from '../../../../src/store/premium';
import { useSettings } from '../../../../src/store/settings';
import type { ContentBundle, GlossaryTerm } from '../../../../src/types';

const stamp = (): number => Date.now();
export default function LessonScreen() {
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>(); const bundle = useBundle();
  return <LessonReader key={`${bundle.lang}-${lessonId}`} lessonId={Number(lessonId)} bundle={bundle} />;
}
function LessonReader({ lessonId, bundle }: { lessonId: number; bundle: ContentBundle }) {
  const { t } = useTranslation(); const text = useCompletionText(); const router = useRouter(); const theme = useTheme();
  const passPercent = useSettings((s) => learningPassPercent(s.quizLevel));
  const textScale = useSettings((s) => s.textScale); const setTextScale = useSettings((s) => s.setTextScale);
  const setThemeMode = useSettings((s) => s.setThemeMode);
  const progress = useProgress(); const premiumUnlocked = usePremium((s) => s.unlocked); const jurisdictionId = useSettings((s) => s.jurisdictionId) ?? 'ON'; const { startLesson: start, setLastRoute, addStudyTime, markLessonStudied } = progress;
  const [definition, setDefinition] = useState<GlossaryTerm | null>(null);

  const lesson = bundle.lessons.find((l) => l.id === lessonId);
  const matcher = useMemo(() => makeGlossaryMatcher(bundle.glossary), [bundle]);
  const openTerm = useCallback((term: GlossaryTerm) => { setDefinition(term); }, []);
  useFocusEffect(useCallback(() => {
    if (!lesson) return; start(lesson.id); setLastRoute(`/learn/lesson/${lesson.id}`); const began = stamp();
    return () => addStudyTime(Math.min(Math.max(0, stamp() - began), 1800000));
  }, [lesson, start, setLastRoute, addStudyTime]));
  if (!lesson) return null;
  if (lesson.access === 'premium' && !premiumUnlocked) return <View style={[styles.root, { backgroundColor: theme.colors.background }]}><Stack.Screen options={{ title: lesson.title }} /><View style={{ padding: 16 }}><PaywallCard /></View></View>;
  const chapter = bundle.chapters.find((c) => c.id === lesson.chapterId); const siblings = chapter?.lessonIds ?? [];
  const position = siblings.indexOf(lesson.id) + 1; const nextId = siblings[position]; const quizIds = learningLessonQuizIds(bundle, lesson).filter((qid) => { const q = bundle.questions[qid]; return !lesson.regional || isQuestionForJurisdiction(q, jurisdictionId); });
  const status = lessonStatus(progress, lesson.id); const noQuestions = lesson.questionIds.length === 0; const body = 17 * textScale;
  const goNext = () => { if (nextId !== undefined) router.replace(`/learn/lesson/${nextId}`); else router.back(); };
  const cycleSize = () => setTextScale(textScale >= 1.3 ? 1 : textScale >= 1.15 ? 1.3 : 1.15);
  return <View style={styles.root}>
    <Stack.Screen options={{ title: chapter?.title ?? '', headerRight: () => <View style={styles.headerButtons}><Pressable accessibilityRole='button' accessibilityLabel={t('glossaryUi.title')} onPress={() => router.push('/learn/glossary')} style={styles.headerButton}><Text style={styles.headerText}>▤</Text></Pressable><Pressable accessibilityRole='button' accessibilityLabel={t('lessonUi.textSize')} onPress={cycleSize} style={styles.headerButton}><Text style={styles.headerText}>Aa</Text></Pressable><Pressable accessibilityRole='button' accessibilityLabel={t('lessonUi.theme')} onPress={() => setThemeMode(theme.dark ? 'light' : 'dark')} style={styles.headerButton}><Text style={styles.headerText}>{theme.dark ? '☀️' : '🌙'}</Text></Pressable></View> }} />
    <ScrollView style={{ backgroundColor: theme.colors.background }} contentContainerStyle={styles.content}>
      <View style={styles.titleBlock}><Text variant='headlineMedium' style={{ color: theme.colors.secondary, fontWeight: '700' }}>{lesson.title}</Text><Text variant='labelLarge'>{t('lessonUi.lessonLabel', { n: position })} · {text[status]}</Text></View>
      <Text variant='bodySmall'>{t('glossaryUi.lessonHint')}</Text>
      {lesson.blocks.map((b, i) => <View key={i} style={styles.block}>{b.k === 'li' ? <View style={styles.li}><Text style={{ fontSize: body, lineHeight: body * 1.65 }}>•</Text><RichText text={b.t} size={body} style={styles.grow} matcher={matcher} onTerm={openTerm} /></View> : <RichText text={b.t} variant={b.k === 'h' ? 'titleMedium' : 'bodyLarge'} size={b.k === 'h' ? 20 * textScale : body} style={b.k === 'h' ? styles.heading : undefined} matcher={matcher} onTerm={openTerm} />}</View>)}
      {lesson.source ? <CitationCard source={lesson.source} /> : null}
      <View style={styles.actions}>
        <Text accessibilityLiveRegion='polite'>{status === 'completed' ? text.earned : quizIds.length ? text.passRule : noQuestions ? text.noQuiz : text.unavailable}</Text>
        {quizIds.length > 0 ? <Pressable accessibilityRole='button' onPress={() => router.push(`/learn/quiz?kind=lesson&id=${lesson.id}`)} style={[styles.quizCta, { backgroundColor: theme.colors.secondary }]}><View style={styles.grow}><Text style={{ color: theme.colors.onSecondary }}>{t('learnUi.quizCount', { count: quizIds.length })} · {passPercent}%</Text><Text variant='titleMedium' style={{ color: theme.colors.onSecondary }}>{t('lessonUi.startQuiz')}</Text></View><Text style={{ color: theme.colors.onSecondary, fontSize: 26 }}>›</Text></Pressable> : noQuestions && status !== 'completed' ? <Button mode='contained' onPress={() => markLessonStudied(lesson.id, bundle.lang)}>{text.markStudied}</Button> : null}
        <Button mode='outlined' contentStyle={styles.nextButton} onPress={goNext}>{nextId !== undefined ? t('learn.nextLesson') : t('learn.backToChapter')}</Button>
      </View>
    </ScrollView>
    <DefinitionSheet term={definition} onClose={() => setDefinition(null)} onOpen={(term) => { setDefinition(null); router.push(`/learn/glossary?termId=${term.id}`); }} />
  </View>;
}
const styles = StyleSheet.create({ root: { flex: 1 }, content: { padding: 16, paddingBottom: 24, gap: 6 }, titleBlock: { gap: 4, marginBottom: 10 }, block: { borderRadius: 10, paddingVertical: 6, paddingHorizontal: 6 }, heading: { fontWeight: '700' }, li: { flexDirection: 'row', gap: 10 }, grow: { flex: 1 }, actions: { gap: 12, marginTop: 16 }, quizCta: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18, borderRadius: 22 }, nextButton: { paddingVertical: 8 }, headerButtons: { flexDirection: 'row', gap: 4 }, headerButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }, headerText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' } });
