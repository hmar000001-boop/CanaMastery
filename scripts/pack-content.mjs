import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const sourceDir = process.env.CONTENT_JSON_DIR ?? args[0];
if (!sourceDir) {
  console.error('CONTENT_JSON_DIR is required. Supply a private prepared content directory containing content.en.json and content.fr.json.');
  process.exit(2);
}

const outDir = path.resolve('src/content/generated');
fs.mkdirSync(outDir, { recursive: true });
const KEY = Uint8Array.from([0x4b,0x17,0xa2,0x6d,0x39,0xf1,0x82,0x55,0x2c,0x91,0xe4,0x73,0xb8,0x0f,0xc6,0x44,0x9d,0x28,0x71,0xd3,0x5a,0x0c,0xae,0x66,0x15,0xf8,0x31,0x87,0xc2,0x4e,0x79,0x1b,0xa5]);
const REQUIRED_JURISDICTIONS = ['AB','BC','MB','NB','NL','NS','NT','NU','ON','PE','QC','SK','YT'];
const DEFAULT_FREE_CHAPTER_IDS = [1000, 1001, 1002];
const SOURCE_URL = 'https://www.canada.ca/en/immigration-refugees-citizenship/services/new-immigrants/discover-canada/read-online.html';

function obfuscate(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) out[i] = bytes[i] ^ KEY[(i * 7 + 11) % KEY.length] ^ ((i * 31) & 0xff);
  return Buffer.from(out).toString('base64');
}

function normalizeQuestionText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function isCitizenPassQuestion(q) {
  return String(q.conceptId ?? '').startsWith('cp-');
}

function deduplicateQuestions(enQuestions, frQuestions) {
  const frById = new Map(frQuestions.map((q) => [String(q.id), q]));
  const seen = new Map();
  const removed = new Set();
  const kept = [];
  for (const q of enQuestions) {
    const key = normalizeQuestionText(q.question);
    if (!key) {
      kept.push(q);
      continue;
    }
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, q);
      kept.push(q);
      continue;
    }
    const currentIsCp = isCitizenPassQuestion(q);
    const existingIsCp = isCitizenPassQuestion(existing);
    if (currentIsCp && !existingIsCp) {
      removed.add(String(existing.id));
      const idx = kept.findIndex((item) => String(item.id) === String(existing.id));
      if (idx >= 0) kept[idx] = q;
      seen.set(key, q);
    } else {
      removed.add(String(q.id));
    }
  }
  return {
    en: kept,
    fr: frQuestions.filter((q) => !removed.has(String(q.id)) && kept.some((x) => String(x.id) === String(q.id))),
  };
}

function chapterById(chapters) {
  return new Map(chapters.map((chapter) => [String(chapter.id), chapter]));
}

function friendlyAdditionalLessonTitle(chapter, lang, regional = false) {
  const title = chapter?.title ?? (lang === 'fr' ? 'chapitre' : 'chapter');
  if (regional) return lang === 'fr' ? 'Entraînement : votre province ou territoire' : 'Practice: Your province or territory';
  return lang === 'fr' ? `Entraînement : ${title}` : `Practice: ${title}`;
}

function factSentencesForLesson(lessonId, questions, lang) {
  const related = questions.filter((q) => String(q.lessonId) === String(lessonId));
  const seen = new Set();
  const facts = [];
  for (const q of related) {
    const answer = q?.options?.[q.correctIndex];
    if (typeof answer !== 'string') continue;
    const normalized = normalizeQuestionText(answer);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    facts.push(answer.trim());
    if (facts.length >= 5) break;
  }
  return facts;
}

function buildLessonBlocks(lesson, chapters, questions, lang) {
  const chapter = chapters.find((c) => String(c.id) === String(lesson.chapterId));
  const regional = lesson.regional === true;
  const facts = factSentencesForLesson(lesson.id, questions, lang);
  let summary;
  let remember;
  if (Number(lesson.id) === 2473) {
    summary = lang === 'fr'
      ? 'Commencez ici pour comprendre la structure de CanaMastery, votre parcours d’étude et les principales fonctions de préparation à l’examen.'
      : 'Start here to understand the CanaMastery study path, how lessons and practice work, and how to prepare for the citizenship test.';
    remember = lang === 'fr'
      ? ['Votre province ou territoire personnalise les questions régionales affichées.', 'Le mode examen suit le format de 20 questions, 45 minutes et 15 bonnes réponses pour réussir.']
      : ['Your province or territory personalizes the regional questions shown to you.', 'Mock exams use 20 questions, 45 minutes, and 15 correct answers to pass.'];
  } else if (Number(lesson.id) === 20) {
    summary = lang === 'fr'
      ? 'Cette leçon explique le test de citoyenneté, son objectif et les informations générales à connaître avant de commencer votre préparation.'
      : 'This lesson explains the citizenship test, its purpose, and the key information to know before you begin studying.';
    remember = lang === 'fr'
      ? ['Les questions de l’examen sont basées sur le guide officiel Discover Canada.', 'Vérifiez toujours les instructions actuelles d’IRCC pour votre situation personnelle.']
      : ['The test questions are based on the official Discover Canada study guide.', 'Always check current IRCC instructions for your own situation.'];
  } else if (facts.length) {
    const chapterLabel = chapter?.title ?? (lang === 'fr' ? 'ce chapitre' : 'this chapter');
    summary = lang === 'fr'
      ? `${lesson.title} présente les éléments essentiels à retenir sur ${chapterLabel}. Utilisez les faits ci-dessous comme points de révision rapides, puis entraînez-vous avec les questions associées.`
      : `${lesson.title} highlights the key ideas to remember about ${chapterLabel}. Use the facts below as quick review points, then practise with the questions for this lesson.`;
    remember = facts.map((fact) => `${lang === 'fr' ? 'À retenir' : 'Remember'}: ${fact}`);
  } else {
    const chapterLabel = chapter?.title ?? lesson.title;
    summary = lang === 'fr'
      ? `${lesson.title} résume les points essentiels de ${chapterLabel}. Révisez cette leçon puis utilisez l’entraînement pour vérifier ce que vous retenez.`
      : `${lesson.title} summarizes the key ideas from ${chapterLabel}. Review this lesson, then use practice questions to check what you remember.`;
    remember = [lang === 'fr' ? 'Révisez les idées principales avant de passer à l’entraînement.' : 'Review the main ideas before moving to practice.'];
  }
  return [
    { heading: lang === 'fr' ? 'Résumé rapide' : 'Quick summary', text: summary },
    { heading: lang === 'fr' ? 'À retenir' : 'What to remember', bullets: remember },
  ];
}

function normalizeBundle(data, lang) {
  const chapters = data.chapters ?? [];
  const questionValues = Object.values(data.questions ?? {});
  const chapterMap = chapterById(chapters);
  for (const lesson of data.lessons ?? []) {
    const ownQuestions = questionValues.filter((q) => String(q.lessonId) === String(lesson.id));
    lesson.questionIds = ownQuestions.map((q) => q.id);
    if (String(lesson.title).toLowerCase().includes('additional practice') || String(lesson.title).toLowerCase().includes('additional regional practice') || String(lesson.title).toLowerCase().includes('entraînement additionnel')) {
      lesson.title = friendlyAdditionalLessonTitle(chapterMap.get(String(lesson.chapterId)), lang, lesson.regional === true);
    }
    lesson.blocks = buildLessonBlocks(lesson, chapters, questionValues, lang);
    lesson.hasAudio = false;
    delete lesson.audioUrl;
    delete lesson.audio;
  }
  for (const q of questionValues) {
    delete q.source?.excerpt;
    delete q.source?.quote;
  }
  return data;
}

function rebuildExams(data) {
  const questions = Object.values(data.questions ?? {});
  const unique = new Set();
  const pool = questions.filter((q) => q.access !== 'premium');
  const allPool = questions;
  const choose = (source, requestedIds = []) => {
    const ids = [];
    for (const id of requestedIds) {
      const key = String(id);
      if (!ids.includes(key) && source.some((q) => String(q.id) === key)) ids.push(key);
    }
    for (const q of source.filter((item) => !item.regional)) {
      const key = String(q.id);
      if (!ids.includes(key)) ids.push(key);
      if (ids.length === 20) return ids;
    }
    for (const q of source) {
      const key = String(q.id);
      if (!ids.includes(key)) ids.push(key);
      if (ids.length === 20) return ids;
    }
    return ids.slice(0, 20);
  };
  const exams = data.exams ?? [];
  for (let i = 0; i < exams.length; i += 1) {
    const exam = exams[i];
    const source = i === 0 || exam.access === 'free' ? pool : allPool;
    exam.questionIds = choose(source, exam.questionIds ?? []);
    if (exam.questionIds.length !== 20) throw new Error(`Exam ${exam.id} cannot be built with 20 questions.`);
    exam.access = i === 0 ? 'free' : 'premium';
    unique.add(exam.id);
  }
  if (!exams.length) throw new Error('No exams found.');
  return data;
}

function validatePreparedData(en, fr) {
  if (String(en.sourceEdition ?? '') !== String(fr.sourceEdition ?? '')) throw new Error('EN/FR sourceEdition mismatch');
  if (String(en.sourceCheckedOn ?? '') !== String(fr.sourceCheckedOn ?? '')) throw new Error('EN/FR sourceCheckedOn mismatch');
  const enIds = Object.keys(en.questions ?? {}).sort();
  const frIds = Object.keys(fr.questions ?? {}).sort();
  if (enIds.join('|') !== frIds.join('|')) throw new Error('EN/FR question IDs do not match');
  if (!en.questions || !fr.questions) throw new Error('Missing question data');
  for (const q of Object.values(en.questions)) {
    if (q.source?.excerpt || q.source?.quote) throw new Error(`Question ${q.id} contains forbidden source excerpt/quote.`);
    if (q.regional === true && (!Array.isArray(q.jurisdictionIds) || !q.jurisdictionIds.length)) throw new Error(`Regional question ${q.id} is missing jurisdictionIds.`);
    if (!q.source?.url || !q.source?.title || !q.source?.checkedOn) throw new Error(`Question ${q.id} is missing detailed source citation metadata.`);
  }
  for (const lesson of Object.values(en.lessons ?? [])) {
    if (lesson.blocks?.some?.((b) => typeof b.text === 'string' && /Discover Canada|source excerpt/i.test(b.text))) continue;
  }
}

const enInput = path.join(sourceDir, 'content.en.json');
const frInput = path.join(sourceDir, 'content.fr.json');
if (!fs.existsSync(enInput) || !fs.existsSync(frInput)) throw new Error('Missing content.en.json or content.fr.json.');
let en = JSON.parse(fs.readFileSync(enInput, 'utf8'));
let fr = JSON.parse(fs.readFileSync(frInput, 'utf8'));

const deduped = deduplicateQuestions(Object.values(en.questions ?? {}), Object.values(fr.questions ?? {}));
en.questions = Object.fromEntries(deduped.en.map((q) => [String(q.id), q]));
fr.questions = Object.fromEntries(deduped.fr.map((q) => [String(q.id), q]));

const sourceCheckedOn = en.sourceCheckedOn ?? '2026-11-23';
en.sourceCheckedOn = sourceCheckedOn;
fr.sourceCheckedOn = sourceCheckedOn;
en.freeChapterIds = en.freeChapterIds ?? DEFAULT_FREE_CHAPTER_IDS;
fr.freeChapterIds = fr.freeChapterIds ?? en.freeChapterIds;
en.sourceUrl = en.sourceUrl ?? SOURCE_URL;
fr.sourceUrl = fr.sourceUrl ?? SOURCE_URL;

en = normalizeBundle(en, 'en');
fr = normalizeBundle(fr, 'fr');
en = rebuildExams(en);
fr.exams = JSON.parse(JSON.stringify(en.exams));

validatePreparedData(en, fr);

for (const lang of ['en', 'fr']) {
  const data = lang === 'en' ? en : fr;
  const payload = obfuscate(data);
  const chunks = payload.match(/.{1,160}/g) ?? [];
  const varName = lang === 'en' ? 'contentEnPayload' : 'contentFrPayload';
  const file = `import { decodeContent } from '../obfuscation';\nimport type { ContentBundle } from '../../types';\n\nconst ${varName} = [\n${chunks.map((x) => `  '${x}'`).join(',\n')}\n].join('');\n\nexport const content${lang === 'en' ? 'En' : 'Fr'} = decodeContent(${varName}) as ContentBundle;\n`;
  fs.writeFileSync(path.join(outDir, `content.${lang}.ts`), file);
}

const questions = Object.values(en.questions);
const jurisdictionCounts = Object.fromEntries(REQUIRED_JURISDICTIONS.map((id) => [id, questions.filter((q) => q.regional === true && Array.isArray(q.jurisdictionIds) && q.jurisdictionIds.includes(id)).length]));
const manifest = {
  contentVersion: en.contentVersion,
  sourceEdition: en.sourceEdition,
  sourceCheckedOn: en.sourceCheckedOn,
  sourceUrl: en.sourceUrl,
  chapters: en.chapters.length,
  lessons: en.lessons.length,
  questions: questions.length,
  freeQuestions: questions.filter((q) => q.access === 'free').length,
  premiumQuestions: questions.filter((q) => q.access === 'premium').length,
  regionalQuestions: questions.filter((q) => q.regional === true).length,
  exams: en.exams.length,
  glossary: en.glossary.length,
  freeChapterIds: en.freeChapterIds,
  jurisdictionCounts,
  obfuscation: 'xor-rotating-key-v1',
  editorialReview: 'pending',
};
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Packed commercial content: ${manifest.questions} questions, ${manifest.lessons} lessons, ${manifest.chapters} chapters, ${manifest.exams} exams.`);
