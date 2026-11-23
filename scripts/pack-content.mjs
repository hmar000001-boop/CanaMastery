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

function obfuscate(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) {
    out[i] = bytes[i] ^ KEY[(i * 7 + 11) % KEY.length] ^ ((i * 31) & 0xff);
  }
  return Buffer.from(out).toString('base64');
}

function normalize(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function validateBundle(bundle, lang) {
  const questions = Object.values(bundle.questions ?? {});
  if (!Array.isArray(bundle.chapters) || !Array.isArray(bundle.lessons) || !Array.isArray(bundle.exams)) {
    throw new Error(`${lang}: missing chapters, lessons, or exams.`);
  }
  if (!Array.isArray(bundle.freeChapterIds) || bundle.freeChapterIds.length === 0) {
    throw new Error(`${lang}: missing freeChapterIds.`);
  }
  const questionText = new Map();
  for (const q of questions) {
    if (!q.text || !q.text.trim()) throw new Error(`${lang}: question ${q.id} has empty text.`);
    const key = normalize(q.text);
    if (questionText.has(key)) throw new Error(`${lang}: duplicate rewritten question text for ${q.id} and ${questionText.get(key)}.`);
    questionText.set(key, q.id);
    if (q.source?.excerpt || q.source?.quote || q.sourceExcerpt) throw new Error(`${lang}: raw source excerpt found in question ${q.id}.`);
    if (!q.source?.url || !q.source?.title || !q.source?.checkedOn) throw new Error(`${lang}: missing citation metadata for question ${q.id}.`);
    if (q.regional && (!Array.isArray(q.jurisdictionIds) || q.jurisdictionIds.length !== 1)) {
      throw new Error(`${lang}: regional question ${q.id} must have exactly one jurisdiction.`);
    }
  }
  for (const lesson of bundle.lessons) {
    if (lesson.source?.excerpt || lesson.source?.quote) throw new Error(`${lang}: raw source excerpt found in lesson ${lesson.id}.`);
    if (!lesson.blocks || lesson.blocks.length === 0) throw new Error(`${lang}: lesson ${lesson.id} has no summary blocks.`);
    if (!Array.isArray(lesson.questionIds)) throw new Error(`${lang}: lesson ${lesson.id} has no questionIds array.`);
  }
  for (const chapter of bundle.chapters) {
    if (!chapter.source?.url || !chapter.source?.title || !chapter.source?.checkedOn) throw new Error(`${lang}: chapter ${chapter.id} is missing citation metadata.`);
  }
  for (const exam of bundle.exams) {
    if (!Array.isArray(exam.questionIds) || exam.questionIds.length !== 20) throw new Error(`${lang}: exam ${exam.id} must contain exactly 20 questions.`);
    if (new Set(exam.questionIds).size !== 20) throw new Error(`${lang}: exam ${exam.id} contains duplicate questions.`);
  }
  const counts = Object.fromEntries(REQUIRED_JURISDICTIONS.map((id) => [id, 0]));
  for (const q of questions) {
    if (q.regional) counts[q.jurisdictionIds[0]] += 1;
  }
  return { questions, counts };
}

const enInput = path.join(sourceDir, 'content.en.json');
const frInput = path.join(sourceDir, 'content.fr.json');
if (!fs.existsSync(enInput) || !fs.existsSync(frInput)) throw new Error('Missing content.en.json or content.fr.json.');
const en = JSON.parse(fs.readFileSync(enInput, 'utf8'));
const fr = JSON.parse(fs.readFileSync(frInput, 'utf8'));
const enCheck = validateBundle(en, 'en');
const frCheck = validateBundle(fr, 'fr');

const enIds = Object.keys(en.questions ?? {}).sort();
const frIds = Object.keys(fr.questions ?? {}).sort();
if (enIds.join('|') !== frIds.join('|')) throw new Error('EN/FR question ID sets do not match.');
if (en.chapters.length !== fr.chapters.length || en.lessons.length !== fr.lessons.length || en.exams.length !== fr.exams.length) {
  throw new Error('EN/FR structure counts do not match.');
}
if (en.exams.filter((exam) => exam.access === 'free').length !== 1) throw new Error('There must be exactly one free exam.');
if (en.passMark !== 15 || en.examSize !== 20 || en.examMinutes !== 45) throw new Error('Official exam settings must remain 15/20, 20 questions, and 45 minutes.');

for (const lang of ['en', 'fr']) {
  const data = lang === 'en' ? en : fr;
  const payload = obfuscate(data);
  const chunks = payload.match(/.{1,160}/g) ?? [];
  const varName = lang === 'en' ? 'contentEnPayload' : 'contentFrPayload';
  const file = `import { decodeContent } from '../obfuscation';\nimport type { ContentBundle } from '../../types';\n\nconst ${varName} = [\n${chunks.map((x) => `  '${x}'`).join(',\n')}\n].join('');\n\nexport const content${lang === 'en' ? 'En' : 'Fr'} = decodeContent(${varName}) as ContentBundle;\n`;
  fs.writeFileSync(path.join(outDir, `content.${lang}.ts`), file);
}

const questions = enCheck.questions;
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
  jurisdictionCounts: enCheck.counts,
  obfuscation: 'xor-rotating-key-v1',
  editorialReview: 'pending',
};

const auditPath = path.join(sourceDir, 'content-audit.json');
if (fs.existsSync(auditPath)) {
  const audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
  manifest.sourceQuestionCount = audit.sourceQuestionCount;
  manifest.duplicatesRemoved = audit.duplicatesRemoved;
  manifest.enRewriteSimilarityMax = audit.enRewriteSimilarityMax;
  manifest.frRewriteSimilarityMax = audit.frRewriteSimilarityMax;
  manifest.enRewriteSimilarityAbove90 = audit.enRewriteSimilarityAbove90;
  manifest.frRewriteSimilarityAbove90 = audit.frRewriteSimilarityAbove90;
  manifest.enRewriteSimilarityAbove70 = audit.enRewriteSimilarityAbove70;
  manifest.frRewriteSimilarityAbove70 = audit.frRewriteSimilarityAbove70;
  manifest.rewrittenDuplicatesRemoved = audit.rewrittenDuplicatesRemoved;
  manifest.rawSourceTextStoredInRuntime = audit.rawSourceTextStoredInRuntime;
}

fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Packed commercial content: ${manifest.questions} rewritten unique questions, ${manifest.duplicatesRemoved ?? 0} duplicates removed, ${manifest.lessons} lessons, ${manifest.chapters} chapters, ${manifest.exams} exams.`);
