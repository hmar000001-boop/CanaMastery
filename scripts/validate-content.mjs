import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('src/content/generated');
const manifestPath = path.join(root, 'manifest.json');
if (!fs.existsSync(manifestPath)) throw new Error('Missing production content manifest.');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const required = [
  'contentVersion', 'sourceEdition', 'sourceCheckedOn', 'chapters', 'lessons', 'questions',
  'exams', 'glossary', 'freeChapterIds', 'freeQuestions', 'premiumQuestions',
  'regionalQuestions', 'jurisdictionCounts', 'obfuscation', 'sourceUrl', 'editorialReview',
];
for (const key of required) if (!(key in manifest)) throw new Error(`Missing manifest field: ${key}`);
for (const key of ['chapters', 'lessons', 'questions', 'exams', 'glossary', 'freeQuestions', 'premiumQuestions', 'regionalQuestions']) {
  if (!Number.isInteger(manifest[key]) || manifest[key] < 0) throw new Error(`Invalid content count: ${key}`);
}
if (!Array.isArray(manifest.freeChapterIds) || manifest.freeChapterIds.length === 0) throw new Error('Free content must include at least one chapter.');
const requiredJurisdictions = ['AB','BC','MB','NB','NL','NS','NT','NU','ON','PE','QC','SK','YT'];
for (const id of requiredJurisdictions) {
  if (!Number.isInteger(manifest.jurisdictionCounts[id])) throw new Error(`Missing jurisdiction count: ${id}`);
}

const KEY = Uint8Array.from([0x4b,0x17,0xa2,0x6d,0x39,0xf1,0x82,0x55,0x2c,0x91,0xe4,0x73,0xb8,0x0f,0xc6,0x44,0x9d,0x28,0x71,0xd3,0x5a,0x0c,0xae,0x66,0x15,0xf8,0x31,0x87,0xc2,0x4e,0x79,0x1b,0xa5]);
function decodeGenerated(file, varName) {
  const source = fs.readFileSync(file, 'utf8');
  const pattern = new RegExp(`const ${varName} = \\[\\n([\\s\\S]*?)\\n\\]\\.join`);
  const match = source.match(pattern);
  if (!match) throw new Error(`Cannot locate payload in ${file}`);
  const chunks = [...match[1].matchAll(/'([^']*)'/g)].map((m) => m[1]);
  const encoded = Buffer.from(chunks.join(''), 'base64');
  const out = new Uint8Array(encoded.length);
  for (let i = 0; i < encoded.length; i += 1) out[i] = encoded[i] ^ KEY[(i * 7 + 11) % KEY.length] ^ ((i * 31) & 0xff);
  return JSON.parse(new TextDecoder().decode(out));
}

const en = decodeGenerated(path.join(root, 'content.en.ts'), 'contentEnPayload');
const fr = decodeGenerated(path.join(root, 'content.fr.ts'), 'contentFrPayload');
const langs = { en, fr };
const ids = Object.keys(en.questions).sort();
const frIds = Object.keys(fr.questions).sort();
if (ids.join('\n') !== frIds.join('\n')) throw new Error('EN/FR question id sets do not match.');
if (en.chapters.length !== manifest.chapters || en.lessons.length !== manifest.lessons || ids.length !== manifest.questions || en.exams.length !== manifest.exams || en.glossary.length !== manifest.glossary) {
  throw new Error('Manifest counts do not match generated English content.');
}
if (fr.lessons.length !== en.lessons.length || fr.chapters.length !== en.chapters.length || fr.exams.length !== en.exams.length) {
  throw new Error('EN/FR structural counts do not match.');
}

const allQuestions = Object.values(en.questions);
const freeQuestions = allQuestions.filter((q) => q.access === 'free').length;
const premiumQuestions = allQuestions.filter((q) => q.access === 'premium').length;
const regionalQuestions = allQuestions.filter((q) => q.regional === true).length;
if (freeQuestions !== manifest.freeQuestions || premiumQuestions !== manifest.premiumQuestions || regionalQuestions !== manifest.regionalQuestions) {
  throw new Error('Manifest question-access/regional counts do not match.');
}
if (freeQuestions + premiumQuestions !== allQuestions.length) throw new Error('Every question must explicitly declare free or premium access.');
if (en.exams.filter((e) => e.access === 'free').length !== 1) throw new Error('There must be exactly one free exam.');
if (en.exams.some((e) => !Array.isArray(e.questionIds) || e.questionIds.length !== 20)) throw new Error('Every mock exam must contain exactly 20 questions.');
if (en.exams.some((e) => new Set(e.questionIds).size !== 20)) throw new Error('Mock exams cannot contain duplicate question ids.');
if (manifest.editorialReview !== 'pending') throw new Error('Editorial review status must remain pending until human QA is complete.');
if (!Number.isInteger(manifest.sourceQuestionCount) || manifest.sourceQuestionCount < manifest.questions) throw new Error('Invalid sourceQuestionCount.');
if (!Number.isInteger(manifest.duplicatesRemoved) || manifest.duplicatesRemoved < 0) throw new Error('Invalid duplicatesRemoved.');
if (Number(manifest.enRewriteSimilarityMax) >= 0.9 || Number(manifest.frRewriteSimilarityMax) >= 0.9) throw new Error('At least one rewritten question reaches the 90% similarity threshold.');
if (Number(manifest.enRewriteSimilarityAbove90) !== 0 || Number(manifest.frRewriteSimilarityAbove90) !== 0) throw new Error('The rewrite audit reports similarity at or above 90%.');

const jurisdictionCounts = Object.fromEntries(requiredJurisdictions.map((id) => [id, 0]));
const questionTexts = new Set();
for (const q of allQuestions) {
  const textKey = String(q.text ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (questionTexts.has(textKey)) throw new Error(`Duplicate runtime question text found for ${q.id}.`);
  questionTexts.add(textKey);
  if (/Complete this study statement|Complétez cet énoncé d’étude|source question|key fact being tested/i.test(String(q.text ?? ''))) throw new Error(`Generic rewrite fallback found in question ${q.id}.`);
  if (q.type === 'tf') {
    const expected = q.options?.length === 2;
    const text = (q.options ?? []).map((x) => String(x).trim().toLowerCase()).sort().join('|');
    const isTf = text === 'false|true' || text === 'faux|vrai';
    if (!expected || !isTf) throw new Error(`Question ${q.id} is tagged true/false without true/false answer choices.`);
  }
  if (!Array.isArray(q.options) || q.options.length < 2 || !Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex >= q.options.length) throw new Error(`Invalid answer schema for question ${q.id}.`);
  if (q.source?.excerpt || q.source?.quote || q.sourceExcerpt) throw new Error(`Raw source excerpt found in question ${q.id}.`);
  if (!q.source?.url || !q.source?.title || !q.source?.checkedOn) throw new Error(`Missing detailed citation metadata for question ${q.id}.`);
  if (q.regional) {
    if (!Array.isArray(q.jurisdictionIds) || q.jurisdictionIds.length === 0) throw new Error(`Regional question ${q.id} has no jurisdiction ids.`);
    for (const id of q.jurisdictionIds) {
      if (!(id in jurisdictionCounts)) throw new Error(`Unknown jurisdiction ${id} on question ${q.id}.`);
      jurisdictionCounts[id] += 1;
    }
  }
}
for (const id of requiredJurisdictions) if (jurisdictionCounts[id] !== manifest.jurisdictionCounts[id]) throw new Error(`Jurisdiction count mismatch for ${id}.`);

for (const [lang, bundle] of Object.entries(langs)) {
  for (const lesson of bundle.lessons) {
    if (lesson.source?.excerpt || lesson.source?.quote) throw new Error(`Raw source excerpt found in ${lang} lesson ${lesson.id}.`);
    if (lesson.source && (!lesson.source.url || !lesson.source.title)) throw new Error(`Incomplete citation for ${lang} lesson ${lesson.id}.`);
  }
}

console.log(`Content OK: ${manifest.chapters} chapters / ${manifest.lessons} lessons / ${manifest.questions} questions / ${manifest.exams} exams / ${manifest.freeQuestions} free / ${manifest.premiumQuestions} premium / ${manifest.regionalQuestions} regional.`);
