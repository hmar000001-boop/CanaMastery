import type { ContentBundle, Exam, JurisdictionId, Question } from '../types';

export const FREE_CHAPTER_IDS = new Set([17, 21, 26]);

export function isChapterUnlocked(chapterId: number, premiumUnlocked: boolean): boolean {
  return premiumUnlocked || FREE_CHAPTER_IDS.has(chapterId);
}

export function chapterHasRegionalQuestions(bundle: ContentBundle, chapterId: number): boolean {
  const chapter = bundle.chapters.find((candidate) => candidate.id === chapterId);
  if (!chapter) return false;
  return chapter.lessonIds.some((lessonId) => {
    const lesson = bundle.lessons.find((candidate) => candidate.id === lessonId);
    return Boolean(lesson?.questionIds.some((questionId) => bundle.questions[questionId]?.regional === true));
  });
}

export function isQuestionForJurisdiction(question: Question, jurisdictionId: JurisdictionId): boolean {
  if (!question.regional) return true;
  return Array.isArray(question.jurisdictionIds) && question.jurisdictionIds.includes(jurisdictionId);
}

export function eligibleQuestionIds(bundle: ContentBundle, ids: number[], jurisdictionId: JurisdictionId): number[] {
  return [...new Set(ids)].filter((id) => {
    const q = bundle.questions[id];
    return Boolean(q) && isQuestionForJurisdiction(q, jurisdictionId);
  });
}

export function personalizedExamQuestionIds(bundle: ContentBundle, exam: Exam, jurisdictionId: JurisdictionId): number[] {
  const eligible = eligibleQuestionIds(bundle, exam.questionIds, jurisdictionId).filter((id) => exam.access === 'premium' || bundle.questions[id]?.access !== 'premium');
  if (eligible.length >= bundle.examSize) return eligible.slice(0, bundle.examSize);
  const existing = new Set(eligible);
  const fallback = Object.values(bundle.questions)
    .filter((q) => isQuestionForJurisdiction(q, jurisdictionId) && (q.access === 'free' || exam.access === 'premium') && !existing.has(q.id))
    .sort((a, b) => a.id - b.id)
    .map((q) => q.id);
  return [...eligible, ...fallback].slice(0, bundle.examSize);
}
