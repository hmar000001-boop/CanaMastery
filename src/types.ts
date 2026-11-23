export type Lang = 'fr' | 'en';
export type Block = { k: 'p' | 'h' | 'li'; t: string };
export type QType = 'mc' | 'tf';
export type ContentAccess = 'free' | 'premium';
export type JurisdictionId = 'AB' | 'BC' | 'MB' | 'NB' | 'NL' | 'NS' | 'NT' | 'NU' | 'ON' | 'PE' | 'QC' | 'SK' | 'YT';

export interface SourceCitation {
  guideTitle: string;
  title: string;
  url: string;
  checkedOn: string;
}

export interface Question {
  id: number;
  conceptId: string;
  type: QType;
  text: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  origin: 'lesson' | 'exam';
  lessonId: number | null;
  chapterId: number | null;
  inferred: boolean;
  access?: ContentAccess;
  regional?: boolean;
  jurisdictionIds?: JurisdictionId[];
  source?: SourceCitation;
}

export interface Lesson {
  id: number;
  chapterId: number;
  order: number;
  title: string;
  blocks: Block[];
  hasAudio: boolean;
  questionIds: number[];
  access?: ContentAccess;
  regional?: boolean;
  source?: SourceCitation;
}

export interface Chapter {
  id: number;
  order: number;
  title: string;
  lessonIds: number[];
  access?: ContentAccess;
  source?: SourceCitation;
}

export interface Exam {
  id: number;
  order: number;
  title: string;
  kind: 'mock' | 'practice';
  durationMin: number;
  questionIds: number[];
  access?: ContentAccess;
  source?: SourceCitation;
}

export interface GlossaryTerm {
  id: number;
  term: string;
  definition: string;
}

export interface ContentBundle {
  lang: Lang;
  sample: boolean;
  contentVersion?: string;
  sourceEdition?: string;
  sourceCheckedOn?: string;
  passMark: number;
  examSize: number;
  examMinutes: number;
  freeChapterIds?: number[];
  chapters: Chapter[];
  lessons: Lesson[];
  questions: Record<number, Question>;
  exams: Exam[];
  glossary: GlossaryTerm[];
}

export interface Presented {
  question: Question;
  options: string[];
  correctIndex: number;
}

export type Grade = 'know' | 'guess' | 'unknown';

export interface SrsCard {
  questionId: number;
  conceptId: string;
  interval: number;
  ease: number;
  reps: number;
  lapses: number;
  due: number;
  lastReviewed: number;
  lastScheduledAt?: number;
  relearning?: boolean;
}

export interface Answer {
  questionId: number;
  conceptId: string;
  chosen: number | null;
  correct: boolean;
  timeMs: number;
  flagged: boolean;
}

export interface ExamAttempt {
  id: string;
  examId: number;
  lang: Lang;
  jurisdictionId?: JurisdictionId;
  seed: number;
  questionIds: number[];
  startedAt: number;
  finishedAt: number | null;
  limitMs: number;
  answers: Answer[];
  flags?: number[];
  cursor?: number;
  spent?: Record<number, number>;
}
