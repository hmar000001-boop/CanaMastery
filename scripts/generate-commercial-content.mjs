#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const RAW = process.env.RAW_SOURCE_DIR;
if (!RAW) throw new Error('RAW_SOURCE_DIR is required and must contain content.en.json and content.fr.json from the source app build.');
const OUT = path.resolve(process.env.PREPARED_OUT_DIR ?? 'build/prepared-content');
fs.mkdirSync(OUT, { recursive: true });

const GUIDE_URL = 'https://www.canada.ca/en/immigration-refugees-citizenship/corporate/publications-manuals/discover-canada/read-online.html';
const GUIDE_TITLE = 'Discover Canada: The Rights and Responsibilities of Citizenship';
const CHECKED_ON = '2026-11-23';
const CONTENT_VERSION = CHECKED_ON;
const FREE_CHAPTER_IDS = [17, 21, 26];
const REGIONAL_CHAPTER_IDS = new Set([102, 108]);
const JURISDICTIONS = {
  AB: { names: ['alberta'], capitals: ['edmonton'] },
  BC: { names: ['british columbia'], capitals: ['victoria'] },
  MB: { names: ['manitoba'], capitals: ['winnipeg'] },
  NB: { names: ['new brunswick'], capitals: ['fredericton'] },
  NL: { names: ['newfoundland and labrador', 'newfoundland'], capitals: ["st. john's", 'st johns', "saint john's", 'saint johns'] },
  NS: { names: ['nova scotia'], capitals: ['halifax'] },
  NT: { names: ['northwest territories'], capitals: ['yellowknife'] },
  NU: { names: ['nunavut'], capitals: ['iqaluit'] },
  ON: { names: ['ontario'], capitals: ['toronto'] },
  PE: { names: ['prince edward island', 'pei'], capitals: ['charlottetown'] },
  QC: { names: ['quebec'], capitals: ['quebec city', 'quebec', 'québec', 'québec city'] },
  SK: { names: ['saskatchewan'], capitals: ['regina'] },
  YT: { names: ['yukon', 'yukon territory'], capitals: ['whitehorse'] },
};
const EN_STOP = new Set('the a an of to in is are was were and or for on by with as at be that this which what who it its from their his her our your does do did can could should would will shall into over under about between among than then them they these those not one two three first also other another some any all each both very most more less when where how why whom whose'.split(' '));
const FR_STOP = new Set('le la les un une des de du et ou est sont en au aux pour par sur dans que qui ce cette cet ces son sa ses leur leurs ne pas un deux trois premier première aussi autre autres plus moins très quand où comment pourquoi dont avec sans entre parmi tous toutes chaque plusieurs'.split(' '));

const normalize = (s) => String(s ?? '')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[“”"'’`]/g, '')
  .replace(/[^\p{L}\p{N}\s]/gu, ' ')
  .replace(/\s+/g, ' ')
  .trim();
const cleanOption = (s) => String(s ?? '').replace(/^\s*\d+[.)]?\s+/, '').trim();
const stripQuestionPrefix = (s) => String(s ?? '')
  .replace(/^\s*(true or false\??|vrai ou faux\s*\??|fill in the blank\.?|compl[eé]tez[^.]*\.)\s*/i, '')
  .trim();
const tokens = (s, stop) => new Set(normalize(s).split(' ').filter((x) => x && !stop.has(x)));
function jaccard(a, b) {
  let intersection = 0;
  for (const value of a) if (b.has(value)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union === 0 ? 1 : intersection / union;
}
function levenshtein(a, b) {
  const x = String(a);
  const y = String(b);
  if (x === y) return 0;
  if (!x.length) return y.length;
  if (!y.length) return x.length;
  const prev = new Array(y.length + 1);
  const cur = new Array(y.length + 1);
  for (let j = 0; j <= y.length; j += 1) prev[j] = j;
  for (let i = 1; i <= x.length; i += 1) {
    cur[0] = i;
    const xi = x.charCodeAt(i - 1);
    for (let j = 1; j <= y.length; j += 1) {
      const cost = xi === y.charCodeAt(j - 1) ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= y.length; j += 1) prev[j] = cur[j];
  }
  return prev[y.length];
}
function textSimilarity(a, b) {
  const x = normalize(a);
  const y = normalize(b);
  const char = 1 - levenshtein(x, y) / Math.max(1, x.length, y.length);
  const space = x.split(' ').filter(Boolean);
  const words = y.split(' ').filter(Boolean);
  const token = jaccard(new Set(space), new Set(words));
  return Math.max(char, token);
}
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 12);
function seededNumber(seed) { return parseInt(sha(String(seed)).slice(0, 8), 16); }

function loadBundle(lang) {
  const file = path.join(RAW, `content.${lang}.json`);
  if (!fs.existsSync(file)) throw new Error(`Missing source bundle: ${file}`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function questionType(q) {
  const options = (q.options ?? []).map(cleanOption).map(normalize);
  const trueFalse = new Set(['true', 'false']);
  const vraiFaux = new Set(['vrai', 'faux']);
  const isBoolean = options.length === 2 && (options.every((x) => trueFalse.has(x)) || options.every((x) => vraiFaux.has(x)));
  return isBoolean ? 'tf' : 'mc';
}

function correctOption(q) { return cleanOption((q.options ?? [])[q.correctIndex ?? 0] ?? ''); }
function tfCore(text) {
  return normalize(text)
    .replace(/\btrue or false\b/g, '')
    .replace(/\bvrai ou faux\b/g, '')
    .replace(/\bis not\b|\bare not\b|\bwas not\b|\bwere not\b|\bdoes not\b|\bdo not\b|\bdid not\b|\bhas not\b|\bhave not\b|\bnot\b/g, '')
    .replace(/\bne\b|\bnest\b|\bn'est\b|\bpas\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function deduplicateQuestions(enQuestions) {
  const byExact = new Map();
  const base = [];
  for (const q of enQuestions) {
    const answer = normalize(correctOption(q));
    const key = `${questionType(q)}|${normalize(q.text)}|${answer}`;
    if (!byExact.has(key)) {
      byExact.set(key, base.length);
      base.push(q);
    }
  }

  const parent = Array.from({ length: base.length }, (_, i) => i);
  const find = (x) => {
    let i = x;
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const join = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };

  for (let i = 0; i < base.length; i += 1) {
    for (let j = 0; j < i; j += 1) {
      const a = base[i];
      const b = base[j];
      if (questionType(a) !== questionType(b)) continue;
      const sim = textSimilarity(a.text, b.text);
      if (sim < 0.90) continue;
      if (questionType(a) === 'mc') {
        if (normalize(correctOption(a)) === normalize(correctOption(b))) join(i, j);
      } else {
        const ca = tfCore(a.text);
        const cb = tfCore(b.text);
        if (ca === cb || textSimilarity(ca, cb) >= 0.96) join(i, j);
      }
    }
  }

  const groups = new Map();
  for (let i = 0; i < base.length; i += 1) {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(i);
  }

  const chooseRepresentative = (members) => {
    const sorted = [...members].sort((a, b) => {
      const qa = base[a];
      const qb = base[b];
      if (Boolean(qa.lessonId) !== Boolean(qb.lessonId)) return qa.lessonId == null ? 1 : -1;
      return Number(qa.id) - Number(qb.id);
    });
    return sorted[0];
  };
  return [...groups.values()].map((members) => ({ members: members.map((i) => base[i]), representative: base[chooseRepresentative(members)] }));
}

function regionHits(q, lessonTitle = '') {
  const haystack = normalize(`${q.text} ${(q.options ?? []).join(' ')} ${lessonTitle}`);
  const hits = [];
  for (const [id, meta] of Object.entries(JURISDICTIONS)) {
    if (meta.names.some((x) => haystack.includes(normalize(x))) || meta.capitals.some((x) => haystack.includes(normalize(x)))) hits.push(id);
  }
  return [...new Set(hits)];
}
function regionalIds(q, lesson) {
  const chapterId = Number(q.chapterId ?? lesson?.chapterId ?? 0);
  const hits = regionHits(q, lesson?.title ?? '');
  if (hits.length !== 1) return [];
  const text = normalize(q.text);
  const lessonTitle = normalize(lesson?.title ?? '');
  const capitalQuestion = /capital/.test(text) && JURISDICTIONS[hits[0]].names.some((name) => text.includes(normalize(name)));
  const regionalLesson = REGIONAL_CHAPTER_IDS.has(chapterId) || lessonTitle.includes(normalize(JURISDICTIONS[hits[0]].names[0]));
  return regionalLesson || capitalQuestion ? hits : [];
}

function cleanBody(text) {
  return stripQuestionPrefix(text)
    .replace(/_{2,}/g, '_____')
    .replace(/\s+/g, ' ')
    .replace(/[?]+$/g, '')
    .replace(/\.+$/g, '')
    .trim();
}
function pickVariant(original, variants, seed, lang) {
  const unique = [...new Set(variants.map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean))];
  const scored = unique.map((v, i) => ({
    text: v,
    similarity: textSimilarity(original, v),
    tie: seededNumber(`${seed}|${lang}|${i}`),
  }));
  scored.sort((a, b) => a.similarity - b.similarity || a.tie - b.tie);
  return scored[0]?.text ?? original;
}

function moveLeadingContext(body) {
  const m = /^(in|during|between)\s+((?:the\s+)?\d{3,4}s?(?:\s+(?:and|to)\s+(?:the\s+)?\d{3,4}s?)?),\s*(what|who|which|when|where|why|how|is|are|was|were|does|do|did)\s+(.+)$/i.exec(body);
  if (!m) return body;
  const lead = `${m[1].toLowerCase()} ${m[2]}`;
  return `${m[3]} ${m[4]} ${lead}`.replace(/\s+/g, ' ').trim();
}

function rewriteEnglishFallback(body) {
  const normalized = moveLeadingContext(body).replace(/[?]+$/g, '').trim();
  let m;
  if (/^in canada, are you obliged to (.+)$/i.test(normalized)) {
    return [`Are Canadians required to ${normalized.replace(/^in canada, are you obliged to /i, '')}?`, `Must Canadians ${normalized.replace(/^in canada, are you obliged to /i, '')}?`];
  }
  if (/^in canada, are you allowed to (.+)$/i.test(normalized)) {
    return [`Can Canadians ${normalized.replace(/^in canada, are you allowed to /i, '')}?`, `Do Canadian residents have the right to ${normalized.replace(/^in canada, are you allowed to /i, '')}?`];
  }
  if ((m = /^someone will come to your door before a provincial election\. (.+?)\. what are they called$/i.exec(normalized))) {
    return [`What do you call people who visit homes before a provincial election to collect eligible-voter names?`, `Which term identifies the workers who collect the names of eligible voters before a provincial election?`];
  }
  if ((m = /^who is the person to whom we make our oath of citizenship, and who represents all canadians$/i.exec(normalized))) {
    return [`Who receives the Canadian citizenship oath on behalf of Canada?`, `Which person represents Canadians as the recipient of the citizenship oath?`];
  }
  if ((m = /^the first elected representative assembly in canada was in _+$/i.exec(normalized))) {
    return [`In which year was Canada's first elected representative assembly established?`, `When was Canada's first elected representative assembly formed?`];
  }
  if ((m = /^which of the following is in (.+)$/i.exec(normalized))) {
    return [`Which member belongs to ${m[1]}?`, `Which country or organization is included in ${m[1]}?`];
  }
  if ((m = /^which province was the first (.+)$/i.exec(normalized))) {
    return [`Which province achieved the distinction of being first to ${m[1]}?`, `Which province was the earliest to ${m[1]}?`];
  }
  if ((m = /^what happens if the majority of elected representatives in the House of Commons vote that (.+)$/i.exec(normalized))) {
    return [`What political consequence follows when a majority of MPs declare that ${m[1]}?`, `What happens after the House of Commons loses confidence in the cabinet?`];
  }
  if ((m = /^which province is in the most easterly part of North America$/i.exec(normalized))) {
    return [`Which province contains Canada's most easterly point in North America?`, `Which province lies at the eastern edge of Canada?`];
  }
  if ((m = /^what was the name of the country that (.+?) established called$/i.exec(normalized))) {
    return [`Which country emerged from the union described by ${m[1]}?`, `What country resulted from the establishment involving ${m[1]}?`];
  }
  if ((m = /^when was the Hudson'?s Bay Company allowed to look for fur in all of the land that had water flowing into Hudson Bay$/i.exec(normalized))) {
    return [`In which year did the Hudson's Bay Company receive permission to seek furs throughout the lands draining into Hudson Bay?`, `When was the Hudson's Bay Company granted that fur-trading territory?`];
  }
  if ((m = /^which region of Canada is known for its fertile agricultural land and valuable energy resources$/i.exec(normalized))) {
    return [`Which Canadian region combines productive farmland with major energy resources?`, `What region is recognized for both fertile agriculture and valuable energy resources?`];
  }
  if ((m = /^which three countries became partners in the North American Free Trade Agreement \(NAFTA\) in 1994$/i.exec(normalized))) {
    return [`Which countries formed the NAFTA partnership in 1994?`, `Name the three countries that entered NAFTA together in 1994.`];
  }
  if ((m = /^which of the following documents secures Canadians'? freedom of conscience, religion, thought, and belief$/i.exec(normalized))) {
    return [`What document protects Canadians' freedom of conscience, religion, thought, and belief?`, `Which Canadian rights document guarantees those freedoms?`];
  }
  if ((m = /^which of the following anthems is officially designated as the Royal Anthem of Canada, performed to honor the Sovereign during state occasions$/i.exec(normalized))) {
    return [`Which anthem serves as Canada's Royal Anthem at official occasions honouring the Sovereign?`, `What is the Royal Anthem used for Canadian state ceremonies?`];
  }
  if ((m = /^which of the following rights is not guaranteed by the Canadian Charter of Rights and Freedoms$/i.exec(normalized))) {
    return [`Which right falls outside the guarantees of the Canadian Charter?`, `Which right is not protected by the Charter of Rights and Freedoms?`];
  }
  if ((m = /^which group was well established in the territories of modern-day Canada before Europeans arrived$/i.exec(normalized))) {
    return [`Which people had an established presence in what is now Canada before European arrival?`, `Which group lived throughout present-day Canadian territories before Europeans arrived?`];
  }
  if ((m = /^which war saw Canada emerge as a key player in the global arena, gaining international respect$/i.exec(normalized))) {
    return [`During which war did Canada gain greater international recognition?`, `Which conflict helped establish Canada's reputation on the world stage?`];
  }
  if ((m = /^which of the following contributed to the adoption of multiculturalism as an official policy in Canada in 1971$/i.exec(normalized))) {
    return [`What factor contributed to Canada's adoption of multiculturalism as official policy in 1971?`, `Which development helped make multiculturalism an official Canadian policy in 1971?`];
  }
  if ((m = /^which of the following provinces was not one of the original provinces that formed Confederation in 1867$/i.exec(normalized))) {
    return [`Which province was not among the four provinces that formed Confederation in 1867?`, `Which province joined Canada later rather than being part of the original Confederation?`];
  }
  if ((m = /^which of the following is not part of the three key facts about Canada'?s system of government$/i.exec(normalized))) {
    return [`Which statement does not belong among the three key facts about Canada's system of government?`, `Which idea falls outside the main facts used to describe Canada's system of government?`];
  }
  if ((m = /^who is the person who (.+)$/i.exec(normalized))) {
    return [`Which person is identified by ${m[1]}?`, `Who is associated with the role described by ${m[1]}?`];
  }
  if ((m = /^who is the head of state$/i.exec(normalized))) {
    return [`Who serves as Canada's Head of State?`, `Which person holds the role of Canada's Head of State?`];
  }
  if ((m = /^who is a great hero of (.+)$/i.exec(normalized))) {
    return [`Which historical figure is remembered as a great hero of ${m[1]}?`, `Who is associated with the role of a great hero of ${m[1]}?`];
  }
  if ((m = /^who is (?:seen by many as )?the father of (.+)$/i.exec(normalized))) {
    return [`Which historical figure is known as the Father of ${m[1]}?`, `Who is associated with the title Father of ${m[1]}?`];
  }
  if ((m = /^how are (.+?) (chosen|appointed|selected)$/i.exec(normalized))) {
    return [`What process is used to ${m[2]} ${m[1]}?`, `How is the selection or appointment of ${m[1]} carried out?`];
  }
  if ((m = /^where are (.+?) (settled|located|found)$/i.exec(normalized))) {
    return [`Which place is associated with ${m[1]}?`, `Where can ${m[1]} be found or handled?`];
  }
  if ((m = /^where did (.+?) (?:get its name|come from)$/i.exec(normalized))) {
    return [`What is the origin of the name of ${m[1]}?`, `Where does the name of ${m[1]} come from?`];
  }
  if ((m = /^where did (.+?) (?:the )?(?:flag|british|alberta) (.+)$/i.exec(normalized))) {
    return [`Which location is associated with ${m[1]} ${m[2]}?`, `What place is linked to ${m[1]} ${m[2]}?`];
  }
  if ((m = /^when is (.+?) celebrated$/i.exec(normalized))) {
    return [`On what date is ${m[1]} observed?`, `Which date marks ${m[1]}?`];
  }
  if ((m = /^who are the (.+)$/i.exec(normalized))) {
    return [`Which people or groups make up ${m[1]}?`, `Which members belong to ${m[1]}?`];
  }
  if ((m = /^which (.+?) are in (.+)$/i.exec(normalized))) {
    return [`Which ${m[1]} are part of ${m[2]}?`, `Which ${m[1]} belong to ${m[2]}?`];
  }
  if ((m = /^where are (.+)$/i.exec(normalized))) {
    return [`Where can ${m[1]} be found?`, `Which location contains ${m[1]}?`];
  }
  if ((m = /^in which (region|province|territory|city|place) (?:do|does|did|is|are) (.+)$/i.exec(normalized))) {
    return [`Which ${m[1]} contains or is associated with ${m[2]}?`, `In which ${m[1]} does ${m[2]} occur?`];
  }
  if ((m = /^who were people in the rebellions fighting against (?:in .+)?$/i.exec(normalized))) {
    return [`Which group did people in the rebellions oppose?`, `Who were the rebellions fought against?`];
  }
  if ((m = /^who were (.+)$/i.exec(normalized))) {
    return [`Which people or groups are identified by ${m[1]}?`, `Which group is described by ${m[1]}?`];
  }
  if ((m = /^who was (?:a|an|the) (.+)$/i.exec(normalized))) {
    return [`Which person is identified as ${m[1]}?`, `Which historical figure is described as ${m[1]}?`];
  }
  if ((m = /^which were the (.+)$/i.exec(normalized))) {
    return [`Which set includes the ${m[1]}?`, `What group made up the ${m[1]}?`];
  }
  if ((m = /^in which of the following (.+)$/i.exec(normalized))) {
    return [`Which listed situation fits the description ${m[1]}?`, `Among the choices, which one matches ${m[1]}?`];
  }
  if ((m = /^which was the (first|last) (province|territory)(?: to (.+))?$/i.exec(normalized))) {
    const tail = m[3] ? ` to ${m[3]}` : '';
    return [`Which ${m[2]} ${m[1]}${tail}?`, `Which ${m[2]} fits the description of the ${m[1]}${tail}?`];
  }
  if ((m = /^when were (.+?) allowed to (.+)$/i.exec(normalized))) {
    return [`When did ${m[1]} gain the right to ${m[2]}?`, `Which period marks the point when ${m[1]} could ${m[2]}?`];
  }
  if ((m = /^what percentage of (.+?) (are|is|were|was) (.+)$/i.exec(normalized))) {
    return [`What proportion of ${m[1]} ${m[2]} ${m[3]}?`, `Which percentage describes ${m[1]} ${m[2]} ${m[3]}?`];
  }
  if ((m = /^which (province|territory) was the (first|last) (.+)$/i.exec(normalized))) {
    return [`Which ${m[1]} was the ${m[2]} ${m[3]}?`, `Which ${m[1]} fits the description of the ${m[2]} ${m[3]}?`];
  }
  if ((m = /^who was the first person to (.+)$/i.exec(normalized))) {
    return [`Which person is credited with being the first to ${m[1]}?`, `Who is identified as the pioneer who ${m[1]}?`];
  }
  if ((m = /^when and why did (.+)$/i.exec(normalized))) {
    return [`Which time period and cause are associated with ${m[1]}?`, `What date and reason explain ${m[1]}?`];
  }
  if ((m = /^what city did (.+?) (capture|take|reach|enter|visit)$/i.exec(normalized))) {
    return [`Which city fell to ${m[1]}?`, `Which city is linked to ${m[1]}'s ${m[2]}?`];
  }
  if ((m = /^what (province|territory) was the (first|last) (.+)$/i.exec(normalized))) {
    return [`Which ${m[1]} was the ${m[2]} ${m[3]}?`, `Which ${m[1]} fits the description of the ${m[2]} ${m[3]}?`];
  }
  if ((m = /^(province|territory|city|group|person|leader|document|law|act|organization) was the (first|last) (.+)$/i.exec(normalized))) {
    return [`Which ${m[1]} was the ${m[2]} ${m[3]}?`, `Which ${m[1]} matches the description of the ${m[2]} ${m[3]}?`];
  }
  if ((m = /^what (dollar bill|banknote) (?:has|features) (.+)$/i.exec(normalized))) {
    return [`Which ${m[1]} features ${m[2]}?`, `On which ${m[1]} does ${m[2]} appear?`];
  }
  if ((m = /^what month and day do (.+)$/i.exec(normalized))) {
    return [`On which date is ${m[1]}?`, `Which day and month apply to ${m[1]}?`];
  }
  if ((m = /^what does (.+?) stand(?:s)? for$/i.exec(normalized))) {
    return [`What full name is represented by ${m[1]}?`, `Which words are abbreviated by ${m[1]}?`];
  }
  if ((m = /^what (?:is|are) (?:two|three|four) (.+)$/i.exec(normalized))) {
    return [`Which set contains the correct ${m[1]}?`, `Which group lists the required ${m[1]}?`];
  }
  if ((m = /^what did (.+?) want (.+?) to do$/i.exec(normalized))) {
    return [`What did ${m[1]} ask ${m[2]} to do?`, `Which action did ${m[1]} seek from ${m[2]}?`];
  }
  if ((m = /^what did (.+?) become$/i.exec(normalized))) {
    return [`Which role or status did ${m[1]} take on?`, `How did ${m[1]} come to be identified?`];
  }
  if ((m = /^what did (.+?) do$/i.exec(normalized))) {
    return [`Which action is associated with ${m[1]}?`, `What is ${m[1]} known for doing?`];
  }
  if ((m = /^what did (.+?) (.+)$/i.exec(normalized))) {
    return [`Which result is associated with ${m[1]} ${m[2]}?`, `How did ${m[1]} affect ${m[2]}?`];
  }
  if ((m = /^what does (.+?) do$/i.exec(normalized))) {
    return [`What role does ${m[1]} perform?`, `Which function is associated with ${m[1]}?`];
  }
  if ((m = /^what does (.+?) mean$/i.exec(normalized))) {
    return [`How is ${m[1]} defined?`, `Which meaning applies to ${m[1]}?`];
  }
  if ((m = /^what (.+?) (?:is|are) (.+)$/i.exec(normalized))) {
    return [`Which ${m[1]} is associated with ${m[2]}?`, `How is ${m[1]} described in relation to ${m[2]}?`];
  }
  if ((m = /^helping others in the community:?$/i.exec(normalized))) return [`How can Canadians contribute to their communities?`, `Which actions demonstrate service to a Canadian community?`];
  if ((m = /^besides working in the military, what are some other ways to help canada$/i.exec(normalized))) return [`How can Canadians serve the country apart from military service?`, `Which forms of service can Canadians provide outside the military?`];
  if ((m = /^the first canadian woman to practice medicine and founder of the women.?s suffrage movement in canada was:?$/i.exec(normalized))) return [`Which Canadian woman combined a pioneering medical career with leadership in women's suffrage?`, `Who is remembered for advancing both medicine and women's suffrage in Canada?`];
  if ((m = /^a group of canadian landscape painters in the 1920s who painted the wilderness in canada was called:?$/i.exec(normalized))) return [`What name identifies the Canadian painters known for wilderness scenes in the 1920s?`, `Which group became known for painting Canada's wilderness landscapes?`];
  if ((m = /^according to the official study guide, how many electoral districts is canada divided into$/i.exec(normalized))) return [`How many federal electoral districts make up Canada?`, `What is Canada's number of federal electoral districts?`];
  if ((m = /^canada'?s economy includes which three main industries$/i.exec(normalized))) return [`Which three broad industries are identified as major parts of Canada's economy?`, `What are the three principal industries in Canada's economy?`];
  if ((m = /^the acadians are descendants of french colonists who settled where$/i.exec(normalized))) return [`Where did the French settlers who became the Acadians establish their communities?`, `Which region is associated with the early settlement of the Acadians?`];
  if ((m = /^between 1755 and 1763, the acadians were forced to leave canada, and go to britain, france, and another british colonies\. this was called:?$/i.exec(normalized))) return [`What is the historical name for the forced removal of Acadians between 1755 and 1763?`, `Which term describes the displacement of Acadians during that period?`];
  if ((m = /^in what industry do most canadians work$/i.exec(normalized))) return [`Which economic sector employs the largest share of Canadians?`, `What type of industry provides work for most Canadians?`];
  if ((m = /^“a mari usque ad mare” is the the canadian coat of arms and motto, which means:?$/i.exec(normalized))) return [`What idea is expressed by Canada's motto “A Mari Usque Ad Mare”?`, `How should the phrase “A Mari Usque Ad Mare” be understood?`];
  if ((m = /^(what.?s|what is) the first line of canada.?s national anthem$/i.exec(normalized))) return [`How does Canada's national anthem begin?`, `What words open Canada's national anthem?`];
  if ((m = /^in canada.?s justice system what does “presumption of innocence” mean$/i.exec(normalized))) return [`How should the presumption of innocence be understood in Canadian justice?`, `What protection follows from the presumption of innocence?`];
  if ((m = /^the remembrance day poppy symbolizes:?$/i.exec(normalized))) return [`What idea is represented by the poppy on Remembrance Day?`, `What does the Remembrance Day poppy stand for?`];
  if ((m = /^one third of all canadians live in which province$/i.exec(normalized))) return [`Which province is home to roughly one third of Canada's population?`, `Where does about one third of Canada's population live?`];
  if ((m = /^after a federal election, which party forms the new government$/i.exec(normalized))) return [`Which party assumes responsibility for forming the government after a federal election?`, `What determines which party forms the federal government after an election?`];
  if ((m = /^men and women get the same education in canada:?$/i.exec(normalized))) return [`Is equal access to education expected for men and women in Canada?`, `Does Canadian society provide the same educational opportunity to women and men?`];
  if ((m = /^the peace tower, a prominent feature of the parliament hill in ottawa, was completed in 1927 to commemorate which specific group of individuals$/i.exec(normalized))) return [`Whom does Ottawa's Peace Tower commemorate?`, `Which people are honoured by the Peace Tower?`];
  if ((m = /^alberta is recognized as the largest producer of oil and gas in canada primarily due to its extensive reserves of which natural resource$/i.exec(normalized))) return [`Which natural resource is linked to Alberta's extensive oil and gas reserves?`, `What resource helps explain Alberta's major petroleum production?`];
  if ((m = /^the term "great charter of freedoms" historically refers to which foundational document signed in 1215 that established key legal principles in england and influenced canadian rights frameworks$/i.exec(normalized))) return [`Which 1215 document is known as the Great Charter of Freedoms?`, `What foundational English document from 1215 influenced later rights traditions?`];
  if ((m = /^the city originally named york, founded in 1793 by lieutenant governor john graves simcoe, is now known as:?$/i.exec(normalized))) return [`What is the present-day name of the city once known as York?`, `Which Canadian city began as York in 1793?`];
  if ((m = /^what is (.+)$/i.exec(normalized))) {
    return [`How is ${m[1]} defined or identified?`, `Which description best identifies ${m[1]}?`];
  }
  if ((m = /^what are (.+)$/i.exec(normalized))) {
    return [`Which set best describes ${m[1]}?`, `How are ${m[1]} identified?`];
  }
  if ((m = /^who founded (.+)$/i.exec(normalized))) {
    return [`Which person or group established ${m[1]}?`, `Who is associated with the founding of ${m[1]}?`];
  }
  if ((m = /^who helped (.+)$/i.exec(normalized))) {
    return [`Which person or group supported ${m[1]}?`, `Who played a supporting role in ${m[1]}?`];
  }
  if ((m = /^who are (.+)$/i.exec(normalized))) {
    return [`How are ${m[1]} identified?`, `Which people or groups are described by ${m[1]}?`];
  }
  if ((m = /^who (.+)$/i.exec(normalized))) {
    return [`Which person or group is associated with ${m[1]}?`, `Identify the person or group connected to ${m[1]}.`];
  }
  if ((m = /^which (province|territory|city) is in (.+)$/i.exec(normalized))) {
    return [`Which ${m[1]} lies in ${m[2]}?`, `Which ${m[1]} is located in ${m[2]}?`];
  }
  if ((m = /^how is the (.+?) chosen$/i.exec(normalized))) {
    return [`What process determines the selection of the ${m[1]}?`, `How is the ${m[1]} selected?`];
  }
  if ((m = /^in which year did (.+)$/i.exec(normalized))) {
    return [`Which year marks ${m[1]}?`, `When did ${m[1]} take place?`];
  }
  if ((m = /^which are (.+)$/i.exec(normalized))) {
    return [`Which items belong to the group identified by ${m[1]}?`, `Which places or entities make up ${m[1]}?`];
  }
  if ((m = /^when is (.+)$/i.exec(normalized))) {
    return [`On what date is ${m[1]} observed?`, `Which date marks ${m[1]}?`];
  }
  if ((m = /^in which (?:of the following,? )?(english and french|french and english),? must have equal status in canada$/i.exec(normalized))) {
    return [`Where must English and French have equal status in Canada?`, `In which Canadian institutions do English and French have equal status?`];
  }
  if ((m = /^when did (.+)$/i.exec(normalized))) {
    return [`Which year or period saw ${m[1]}?`, `When did the event involving ${m[1]} take place?`];
  }
  if ((m = /^when was (.+)$/i.exec(normalized))) {
    return [`Which year or period marks ${m[1]}?`, `When did ${m[1]} take place?`];
  }
  if ((m = /^where was (.+)$/i.exec(normalized))) {
    return [`At what location did ${m[1]} occur?`, `Which place is associated with ${m[1]}?`];
  }
  if ((m = /^where (.+)$/i.exec(normalized))) {
    return [`Which location is associated with ${m[1]}?`, `At what place did ${m[1]} happen?`];
  }
  if ((m = /^why (.+)$/i.exec(normalized))) {
    return [`Which reason best explains ${m[1]}?`, `What explanation accounts for ${m[1]}?`];
  }
  if ((m = /^(.+?) were united to create:?$/i.exec(normalized))) {
    return [`What was created by bringing ${m[1]} together?`, `Which new entity resulted from the union of ${m[1]}?`];
  }
  if ((m = /^what does (.+?) lead to\??$/i.exec(normalized))) {
    return [`What outcome follows ${m[1]}?`, `Which result can follow ${m[1]}?`];
  }
  if ((m = /^after an election, which party forms the government\??$/i.exec(normalized))) {
    return [`Which party takes office after the election?`, `Which party becomes the governing party after the election?`];
  }
  if ((m = /^(?:what happens|what happened) (.+)$/i.exec(normalized))) {
    return [`What outcome occurs ${m[1]}?`, `Which event follows ${m[1]}?`];
  }
  if ((m = /^in canada, are (.+)$/i.exec(normalized))) {
    return [`Are Canadians allowed to ${m[1]}?`, `Can a person in Canada ${m[1]}?`];
  }
  if ((m = /^according to (.+?), in how many forms is (.+?) officially sung$/i.exec(normalized))) {
    return [`How many official forms of ${m[2]} are recognized by ${m[1]}?`, `In how many official forms does ${m[2]} appear according to ${m[1]}?`];
  }
  if ((m = /^(.+?) is also called:?$/i.exec(normalized))) {
    return [`What other name is used for ${m[1]}?`, `Which name also identifies ${m[1]}?`];
  }
  if ((m = /^all of them are included in (.+?) except for:?$/i.exec(normalized))) {
    return [`Which item is excluded from ${m[1]}?`, `What does not belong among the elements of ${m[1]}?`];
  }
  if ((m = /^the “?(.+?)”? (?:is|means)\s*:?$/i.exec(normalized))) {
    return [`How should the principle or term “${m[1]}” be understood?`, `Which meaning best describes “${m[1]}”?`];
  }
  if ((m = /^the "?(.+?)"? is also know[n]? as:?$/i.exec(normalized))) {
    return [`What legal or historical term describes ${m[1]}?`, `Which term is used for ${m[1]}?`];
  }
  if ((m = /^(.+?) are referred to as the:?$/i.exec(normalized))) {
    return [`What collective name is used for ${m[1]}?`, `Which regional name identifies ${m[1]}?`];
  }
  if ((m = /^(.+?) are called a:?$/i.exec(normalized))) {
    return [`What term is used for ${m[1]}?`, `How are ${m[1]} described collectively?`];
  }
  if ((m = /^(.+?) share jurisdiction over:?$/i.exec(normalized))) {
    return [`Which area falls under shared jurisdiction between ${m[1]}?`, `What subject is jointly governed by ${m[1]}?`];
  }
  if ((m = /^the laws passed by the (.+?) that only affect the local community are called:?$/i.exec(normalized))) {
    return [`What term describes laws made by the ${m[1]} for the local community?`, `How are local laws made by the ${m[1]} classified?`];
  }
  if ((m = /^(.+?) are geographical areas represented by a:?$/i.exec(normalized))) {
    return [`Who represents a federal electoral district?`, `What elected position represents ${m[1]}?`];
  }
  if ((m = /^canada has three territories and how many provinces\??$/i.exec(normalized))) {
    return [`How many provinces accompany Canada's three territories?`, `What is the number of provinces in addition to the three territories?`];
  }
  if ((m = /^what (.+?) means?:?$/i.exec(normalized))) {
    return [`What meaning is expressed by ${m[1]}?`, `Which interpretation best explains ${m[1]}?`];
  }
  if ((m = /^(.+?) is the first line of canada['’]s national anthem:?$/i.exec(normalized))) {
    return [`Which line opens Canada's national anthem?`, `What is the opening line of the national anthem?`];
  }
  if ((m = /^what part of the constitution legally protects (.+)$/i.exec(normalized))) {
    return [`Which constitutional provision protects ${m[1]}?`, `What constitutional protection applies to ${m[1]}?`];
  }
  if ((m = /^in which (.+)$/i.exec(normalized))) {
    return [`Which ${m[1]} is correct?`, `What choice fits the situation described by ${m[1]}?`];
  }
  if ((m = /^name two (.+)$/i.exec(normalized))) {
    return [`Which two examples illustrate ${m[1]}?`, `What pair of examples demonstrates ${m[1]}?`];
  }
  if ((m = /^(.+?) is a:?$/i.exec(normalized))) {
    return [`What does ${m[1]} represent?`, `Which classification applies to ${m[1]}?`];
  }
  if ((m = /^(.+?) :?$/i.exec(normalized)) && /^(the|a|an|all|canada|one|getting|helping|men|women|federal|municipal|according|since|besides)/i.test(normalized)) {
    const topic = m[1].replace(/:\s*$/, '').trim();
    return [`Which statement best completes the idea about ${topic}?`, `What fact correctly completes the statement about ${topic}?`];
  }
  if ((m = /^which (.+?) (is|are|was|were) (.+)$/i.exec(normalized))) {
    return [`Identify the ${m[1]} that ${m[2]} ${m[3]}.`, `Determine which ${m[1]} ${m[2]} ${m[3]}.`];
  }
  if ((m = /^which (.+?) (did|does|do|has|have|can|could|should) (.+)$/i.exec(normalized))) {
    return [`Identify the ${m[1]} that ${m[2]} ${m[3]}.`, `Which ${m[1]} is associated with ${m[3]}?`];
  }
  if ((m = /^which (.+)$/i.exec(normalized))) {
    return [`Identify the answer that best matches ${m[1]}.`, `Determine which choice fits ${m[1]}.`];
  }
  if ((m = /^what (?:is|are|was|were) (.+)$/i.exec(normalized))) {
    return [`How is ${m[1]} defined or identified?`, `Which description best identifies ${m[1]}?`];
  }
  if ((m = /^what (.+)$/i.exec(normalized))) {
    return [`Which fact best explains ${m[1]}?`, `What key fact should be remembered about ${m[1]}?`];
  }
  if ((m = /^since when (.+)$/i.exec(normalized))) {
    return [`From what date or period has ${m[1]}?`, `When did the situation described by ${m[1]} begin?`];
  }
  return null;
}

function rewriteEnglishBlank(body) {
  const n = body.replace(/[?]+$/g, '').trim();
  let m;
  if ((m = /^who (.+)$/i.exec(n))) return `The person or group associated with ${m[1]} is _____.`;
  if ((m = /^when (.+)$/i.exec(n))) return `The date or period associated with ${m[1]} is _____.`;
  if ((m = /^where (.+)$/i.exec(n))) return `The location associated with ${m[1]} is _____.`;
  if ((m = /^why (.+)$/i.exec(n))) return `The reason that explains ${m[1]} is _____.`;
  if ((m = /^how (.+)$/i.exec(n))) return `The method or process associated with ${m[1]} is _____.`;
  if ((m = /^which (.+?) (is|are|was|were) (.+)$/i.exec(n))) return `The ${m[1]} that ${m[2]} ${m[3]} is _____.`;
  if ((m = /^which (.+?) (did|does|do|has|have|can|could|should) (.+)$/i.exec(n))) return `The ${m[1]} that ${m[2]} ${m[3]} is _____.`;
  if ((m = /^what does (.+?) mean$/i.exec(n))) return `The meaning of ${m[1]} is _____.`;
  if ((m = /^what (.+)$/i.exec(n))) return `The answer to the point about ${m[1]} is _____.`;
  return `Complete this study statement: ${n} → _____.`;
}

function rewriteFrenchBlank(body) {
  const n = body.replace(/[?]+$/g, '').trim();
  let m;
  if ((m = /^qui (.+)$/i.exec(n))) return `La personne ou le groupe associé à ${m[1]} est _____.`;
  if ((m = /^quand (.+)$/i.exec(n))) return `La date ou la période associée à ${m[1]} est _____.`;
  if ((m = /^où (.+)$/i.exec(n))) return `Le lieu associé à ${m[1]} est _____.`;
  if ((m = /^pourquoi (.+)$/i.exec(n))) return `La raison qui explique ${m[1]} est _____.`;
  if ((m = /^comment (.+)$/i.exec(n))) return `La méthode ou le processus associé à ${m[1]} est _____.`;
  if ((m = /^(quel|quelle|quels|quelles) (.+?) (est|sont|était|étaient) (.+)$/i.exec(n))) return `L’élément ${m[2]} qui ${m[3]} ${m[4]} est _____.`;
  if ((m = /^(quel|quelle|quels|quelles) (.+?) (a|ont|peut|peuvent|doit|doivent) (.+)$/i.exec(n))) return `L’élément ${m[2]} qui ${m[3]} ${m[4]} est _____.`;
  if ((m = /^qu['’]est-ce qu['’]un? (.+)$/i.exec(n))) return `La définition de ${m[1]} est _____.`;
  if ((m = /^que (.+)$/i.exec(n))) return `La réponse au point portant sur ${m[1]} est _____.`;
  if ((m = /^quel(le|s)? (.+)$/i.exec(n))) return `L’élément correspondant à ${m[2]} est _____.`;
  return `Complétez cet énoncé d’étude : ${n} → _____.`;
}

function rewriteTf(text, lang, seed) {
  const statement = cleanBody(text).replace(/[?]+$/g, '').trim();
  const en = [
    `Consider this claim: ${statement}. Is it accurate?`,
    `How should the following claim be classified? ${statement}.`,
    `What verdict should be given to this statement: ${statement}?`,
  ];
  const fr = [
    `Considérez l’affirmation suivante : ${statement}. Est-elle exacte ?`,
    `Comment faut-il classer l’affirmation suivante ? ${statement}.`,
    `Quel verdict faut-il donner à l’énoncé suivant : ${statement} ?`,
  ];
  return pickVariant(statement, lang === 'en' ? en : fr, seed, lang);
}

function rewriteEnglish(text, seed) {
  const body = cleanBody(text);
  const variants = [];
  let m;
  const structural = rewriteEnglishFallback(body);
  if (structural) return pickVariant(body, structural, seed, 'en').replace(/\?+/g, '?');
  if (/_{2,}/.test(text)) {
    const core = body.replace(/_+/g, '_____');
    return pickVariant(body, [
      `Which option completes the statement: ${core}?`,
      `Which choice fills the missing part of the statement: ${core}?`,
    ], seed, 'en');
  }
  if ((m = /^how much time do you have to (.+)$/i.exec(body))) {
    variants.push(`What time limit applies to ${m[1]}?`, `How much time is allowed for ${m[1]}?`);
  } else if ((m = /^how many (.+)$/i.exec(body))) {
    const x = m[1].replace(/\?+$/, '').trim();
    const v = /^(.*?)\s+(are|were)\s+(.+)$/i.exec(x);
    variants.push(v ? `What is the number of ${v[1]} ${v[3]}?` : `What is the correct number of ${x}?`, v ? `Which total corresponds to ${v[1]} ${v[3]}?` : `What total applies to ${x}?`);
  } else if ((m = /^what (?:is|are) (?:the )?question formats?(?: in| on) (.+)$/i.exec(body))) {
    variants.push(`Which formats are used on ${m[1]}?`, `How is the question format on ${m[1]} described?`);
  } else if ((m = /^what are two other words that can be used instead of (.+)$/i.exec(body))) {
    variants.push(`Which pair of terms can replace ${m[1]}?`, `Which two alternatives can be used in place of ${m[1]}?`);
  } else if ((m = /^to whom do (.+?) make the oath(?: \(promise\))? of citizenship$/i.exec(body))) {
    variants.push(`Who is the citizenship oath addressed to?`, `Which person is the recipient of the citizenship oath?`);
  } else if ((m = /^who is the person who (.+)$/i.exec(body))) {
    variants.push(`Which person is associated with the role described by ${m[1]}?`, `Which individual is identified by the role described here?`);
  } else if ((m = /^in order to become (.+?), you have to provide proof that you speak and write in:$/i.exec(body))) {
    variants.push(`Which language ability must an applicant demonstrate to ${m[1]}?`, `Which official-language requirement is described for ${m[1]}?`);
  } else if ((m = /^what does (.+?) refer to$/i.exec(body))) {
    variants.push(`Which definition best matches ${m[1]}?`, `Which explanation gives the meaning of ${m[1]}?`);
  } else if ((m = /^what does (.+?) do$/i.exec(body))) {
    variants.push(`Which description explains the role of ${m[1]}?`, `What function is performed by ${m[1]}?`);
  } else if ((m = /^what did (.+?) do(?: (.+))?$/i.exec(body))) {
    variants.push(`Which action did ${m[1]} take${m[2] ? ` ${m[2]}` : ''}?`, `What action is associated with ${m[1]}${m[2] ? ` ${m[2]}` : ''}?`);
  } else if ((m = /^what did (.+?) want (.+?) to do$/i.exec(body))) {
    variants.push(`What action did ${m[1]} want ${m[2]} to take?`, `What did ${m[1]} ask ${m[2]} to do?`);
  } else if ((m = /^what did (?:the )?(city|province|territory|government|united states|canada|parliament) (.+)$/i.exec(body))) {
    variants.push(`Which action or result is associated with ${m[1]} ${m[2]}?`, `What is the correct outcome associated with ${m[1]} ${m[2]}?`);
  } else if ((m = /^what did (.+?) (do|allow|capture|create|discover|win|found|lead|want) (.+)$/i.exec(body))) {
    variants.push(`Which result is associated with ${m[1]} ${m[2]} ${m[3]}?`, `What is the correct outcome of ${m[1]} ${m[2]} ${m[3]}?`);
  } else if ((m = /^what happened to (.+)$/i.exec(body))) {
    variants.push(`What occurred in the case of ${m[1]}?`, `How were events experienced by ${m[1]}?`);
  } else if ((m = /^what (?:term|name) began to be used instead of (.+)$/i.exec(body))) {
    variants.push(`Which term replaced ${m[1]}?`, `What term is used instead of ${m[1]}?`);
  } else if ((m = /^what have (.+?) hailed (.+?) as$/i.exec(body))) {
    variants.push(`Which description of ${m[2]} is associated with ${m[1]}?`, `How have ${m[1]} described ${m[2]}?`);
  } else if ((m = /^what (?:two|three|four) (.+)$/i.exec(body))) {
    variants.push(`Which set contains the correct ${m[1]}?`, `Which choices give the correct ${m[1]}?`);
  } else if ((m = /^what is an important expression in (.+)$/i.exec(body))) {
    variants.push(`Which phrase expresses an important principle in ${m[1]}?`, `What expression captures an important idea in ${m[1]}?`);
  } else if ((m = /^what is the name of (.+)$/i.exec(body))) {
    variants.push(`Which document or name identifies ${m[1]}?`, `How is ${m[1]} formally identified?`);
  } else if ((m = /^what is the source of (.+)$/i.exec(body))) {
    variants.push(`Which legal tradition is the source of ${m[1]}?`, `Where does ${m[1]} originate in Canadian law?`);
  } else if ((m = /^what is the legal status of (.+)$/i.exec(body))) {
    variants.push(`How is ${m[1]} classified under Canadian law?`, `What legal classification applies to ${m[1]}?`);
  } else if ((m = /^what is the importance of (.+)$/i.exec(body))) {
    variants.push(`Why is ${m[1]} important?`, `What makes ${m[1]} important?`);
  } else if ((m = /^what makes (.+)$/i.exec(body))) {
    variants.push(`Which factor makes ${m[1]}?`, `What factor allows ${m[1]} to function?`);
  } else if ((m = /^what percentage of (.+)$/i.exec(body))) {
    variants.push(`What proportion of ${m[1]} is reported in the study material?`, `Which percentage applies to ${m[1]}?`);
  } else if ((m = /^what is the (.+)\s*:?$/i.exec(body))) {
    variants.push(`Which option correctly identifies the ${m[1]}?`, `Which description best matches the ${m[1]}?`);
  } else if ((m = /^what are the (.+)\s*:?$/i.exec(body))) {
    variants.push(`Which set correctly identifies the ${m[1]}?`, `Which option lists the ${m[1]}?`);
  } else if ((m = /^what was (.+)$/i.exec(body))) {
    variants.push(`Which option correctly identifies ${m[1]}?`, `Which description best matches ${m[1]}?`);
  } else if ((m = /^what is (.+)$/i.exec(body))) {
    variants.push(`Which description best identifies ${m[1]}?`, `Which option gives the correct description of ${m[1]}?`);
  } else if ((m = /^what are (.+)$/i.exec(body))) {
    variants.push(`Which set correctly identifies ${m[1]}?`, `Which option lists ${m[1]}?`);
  } else if ((m = /^which (?:one of )?(?:the following )?is not (.+)$/i.exec(body))) {
    variants.push(`Which option is not ${m[1]}?`, `Which choice should be excluded from ${m[1]}?`);
  } else if ((m = /^which (?:one of )?(?:the following )?is (.+)$/i.exec(body))) {
    variants.push(`Which option is ${m[1]}?`, `Which choice correctly fits ${m[1]}?`);
  } else if ((m = /^which (?:one of )?(?:the following )?(.+)$/i.exec(body))) {
    variants.push(`Which option ${m[1]}?`, `Which choice best matches ${m[1]}?`);
  } else if ((m = /^who was (.+)$/i.exec(body))) {
    variants.push(`Which historical figure is associated with ${m[1]}?`, `Which person is described by ${m[1]}?`);
  } else if ((m = /^who were (.+)$/i.exec(body))) {
    variants.push(`Which people or groups are described by ${m[1]}?`, `Which group matches ${m[1]}?`);
  } else if ((m = /^who is (.+)$/i.exec(body))) {
    variants.push(`Which person is associated with ${m[1]}?`, `Which individual is identified by ${m[1]}?`);
  } else if ((m = /^when was (.+)$/i.exec(body))) {
    variants.push(`Which year is associated with ${m[1]}?`, `Which date marks ${m[1]}?`);
  } else if ((m = /^when did (.+)$/i.exec(body))) {
    variants.push(`Which year corresponds to the event when ${m[1]}?`, `When did the event described by ${m[1]} take place?`);
  } else if ((m = /^when (.+)$/i.exec(body))) {
    variants.push(`Which date or period corresponds to ${m[1]}?`, `What point in time is associated with ${m[1]}?`);
  } else if ((m = /^where (.+)$/i.exec(body))) {
    variants.push(`Which place is associated with ${m[1]}?`, `What location corresponds to ${m[1]}?`);
  } else if ((m = /^why (.+)$/i.exec(body))) {
    variants.push(`What reason best explains ${m[1]}?`, `Which explanation accounts for ${m[1]}?`);
  } else if ((m = /^how (.+)$/i.exec(body))) {
    variants.push(`Which option explains how ${m[1]}?`, `Which description best explains the way ${m[1]}?`);
  } else if ((m = /^(.+?)\s+is\s*:\s*$/i.exec(body)) || (m = /^(.+?)\s+are\s*:\s*$/i.exec(body))) {
    variants.push(`How should ${m[1]} be classified?`, `Which classification applies to ${m[1]}?`);
  } else if ((m = /^(.+?)\s+is$/i.exec(body)) || (m = /^(.+?)\s+are$/i.exec(body))) {
    variants.push(`How should ${m[1]} be classified?`, `Which classification applies to ${m[1]}?`);
  } else if ((m = /^(.+?) are called a:?$/i.exec(body))) {
    variants.push(`What term describes ${m[1]}?`, `Which term is used for ${m[1]}?`);
  } else if ((m = /^(.+?) are called (.+)$/i.exec(body))) {
    variants.push(`What term describes ${m[1]}?`, `Which term is used for ${m[1]}?`);
  } else if ((m = /^(.+?) refer to:?$/i.exec(body))) {
    variants.push(`What do ${m[1]} mean?`, `How are ${m[1]} defined?`);
  } else if ((m = /^(.+?) is:?$/i.exec(body))) {
    variants.push(`How should ${m[1]} be classified?`, `Which classification applies to ${m[1]}?`);
  } else if ((m = /^(.+?) are:?$/i.exec(body))) {
    variants.push(`How should ${m[1]} be classified?`, `Which classification applies to ${m[1]}?`);
  } else if (/^(can|could|should|does|do|did|is|are|was|were)\b/i.test(body)) {
    variants.push(`Which response correctly evaluates this statement: ${body}?`, `Which option accurately addresses whether ${body}?`);
  } else {
    variants.push(rewriteEnglishFallback(body)?.[0] ?? rewriteEnglishBlank(body), rewriteEnglishFallback(body)?.[1] ?? rewriteEnglishBlank(body));
  }
  return pickVariant(body, variants, seed, 'en').replace(/\bIn (\d{4})/g, 'in $1').replace(/\?+/g, '?');
}

function rewriteFrenchFallback(body) {
  const normalized = moveLeadingContext(body).replace(/[?]+$/g, '').trim();
  let m;
  if ((m = /^pour devenir (.+?), vous devez fournir une preuve que vous parlez et écrivez en\s*:?$/i.exec(normalized))) return [`Quelle compétence linguistique faut-il démontrer pour devenir ${m[1]} ?`, `Quelle exigence linguistique s'applique à la demande de ${m[1]} ?`];
  if ((m = /^dans les années 1830, contre qui les personnes participant aux rébellions se battaient-elles$/i.exec(normalized))) return [`Contre quelles autorités les participants aux rébellions des années 1830 se sont-ils battus ?`, `Quels adversaires les rebelles des années 1830 ont-ils affrontés ?`];
  if ((m = /^en 1948, qu['’]a-t-on finalement permis aux canadiens d['’]origine japonaise de faire$/i.exec(normalized))) return [`Quel changement a été accordé aux Canadiens d'origine japonaise en 1948 ?`, `Quelle possibilité leur a-t-on finalement reconnue en 1948 ?`];
  if ((m = /^lorsque les canadiens votent lors d['’]une élection fédérale, où le candidat gagnant doit-il se rendre$/i.exec(normalized))) return [`Où le député élu à une élection fédérale prend-il son siège ?`, `Dans quelle institution le candidat gagnant d'une élection fédérale siège-t-il ?`];
  if ((m = /^les électeurs peuvent-ils choisir d['’]élire de nouveau la même personne$/i.exec(normalized))) return [`Un électeur peut-il reconduire le même candidat lors d'une autre élection ?`, `Est-il possible de voter encore pour la même personne à une élection suivante ?`];
  if ((m = /^à quelle fréquence les élections fédérales ont-elles lieu$/i.exec(normalized))) return [`À quel intervalle les élections fédérales sont-elles normalement tenues ?`, `Quelle période sépare généralement les élections fédérales ?`];
  if ((m = /^à qui le premier ministre doit-il demander s['’]il souhaite déclencher une élection plus tôt$/i.exec(normalized))) return [`Quelle autorité le premier ministre doit-il consulter pour déclencher une élection anticipée ?`, `À qui le premier ministre demande-t-il la tenue d'une élection avant le terme normal ?`];
  if ((m = /^au canada, êtes-vous obligé de dire aux autres pour qui vous avez voté$/i.exec(normalized))) return [`Le choix d'un électeur lors d'une élection est-il confidentiel ?`, `Doit-on révéler publiquement la personne pour laquelle on a voté au Canada ?`];
  if ((m = /^quelqu['’]un se présentera à votre porte avant une élection provinciale\. on vous demandera les noms des électeurs admissibles qui habitent chez vous\. comment appelle-t-on ces personnes$/i.exec(normalized))) return [`Comment appelle-t-on les personnes qui recueillent les noms des électeurs admissibles avant une élection provinciale ?`, `Quel terme désigne les personnes qui recueillent les renseignements sur les électeurs avant une élection provinciale ?`];
  if ((m = /^au canada, avez-vous le droit de remettre en question le service ou la conduite de la police$/i.exec(normalized))) return [`Pouvez-vous contester le service ou la conduite d'un service de police au Canada ?`, `Un citoyen peut-il remettre en question la conduite de la police ?`];
  if ((m = /^selon patrimoine canadien, sous combien de formes « ô canada » est-il officiellement chanté$/i.exec(normalized))) return [`Combien de versions officielles de « Ô Canada » sont-elles reconnues ?`, `Sous combien de formes « Ô Canada » est-il officiellement interprété ?`];
  if ((m = /^qu['’]est-ce qu['’](un|une) (.+)$/i.exec(normalized))) return [`Comment définit-on ${m[1]} ${m[2]} ?`, `Quelle description correspond à ${m[1]} ${m[2]} ?`];
  if ((m = /^qu['’]est-ce qui (.+)$/i.exec(normalized))) return [`Quel élément correspond à ${m[1]} ?`, `Quelle réponse décrit ce qui ${m[1]} ?`];
  if ((m = /^à quelle fréquence (.+)$/i.exec(normalized))) return [`À quel intervalle ${m[1]} ?`, `Quelle fréquence correspond à ${m[1]} ?`];
  if ((m = /^à qui (.+)$/i.exec(normalized))) return [`Quelle personne ou quelle autorité est concernée par ${m[1]} ?`, `À quelle personne ou autorité ${m[1]} s'adresse-t-il ?`];
  if ((m = /^d['’]où (.+)$/i.exec(normalized))) return [`Quelle est l'origine de ${m[1]} ?`, `À quelle origine faut-il rattacher ${m[1]} ?`];
  if ((m = /^dans quel(le|les) (.+)$/i.exec(normalized))) return [`Dans quel endroit ou quelle catégorie se situe ${m[2]} ?`, `Quel lieu ou quelle catégorie correspond à ${m[2]} ?`];
  if ((m = /^dans lequel (.+)$/i.exec(normalized))) return [`Dans quel cas ${m[1]} ?`, `Quel cas correspond à ${m[1]} ?`];
  if ((m = /^lequel des éléments suivants (.+)$/i.exec(normalized))) return [`Quel élément ${m[1]} ?`, `Quelle option correspond à ${m[1]} ?`];
  if ((m = /^sur lequel des éléments suivants (.+)$/i.exec(normalized))) return [`Sur quel élément repose la situation décrite par ${m[1]} ?`, `Quel élément constitue la réponse à ${m[1]} ?`];
  if ((m = /^de laquelle des responsabilités suivantes (.+)$/i.exec(normalized))) return [`De quelle responsabilité ${m[1]} ?`, `Quelle responsabilité correspond à ${m[1]} ?`];
  if ((m = /^pour qui (.+)$/i.exec(normalized))) return [`Pour quelle personne ou quel groupe ${m[1]} ?`, `Quel bénéficiaire ou quel participant correspond à ${m[1]} ?`];
  if ((m = /^sous quel nom (.+)$/i.exec(normalized))) return [`Quel nom désigne ${m[1]} ?`, `Sous quelle appellation ${m[1]} est-il connu ?`];
  if ((m = /^quel parti forme le nouveau gouvernement$/i.exec(normalized))) return [`Quel parti prend la direction du gouvernement après une élection ?`, `Quelle formation politique forme le gouvernement à l'issue de l'élection ?`];
  if ((m = /^un tiers de tous les canadiens vivent dans quelle province$/i.exec(normalized))) return [`Quelle province compte environ un tiers de la population canadienne ?`, `Où vit approximativement un tiers des Canadiens ?`];
  if ((m = /^what is the highest honour a canadian can receive$/i.exec(normalized))) return [`Quelle est la plus haute distinction qu'un Canadien puisse recevoir ?`, `Quelle distinction représente le plus grand honneur accordé à un Canadien ?`];
  if ((m = /^what is the capital city of canada$/i.exec(normalized))) return [`Quelle est la capitale du Canada ?`, `Quelle ville est la capitale nationale du Canada ?`];
  if ((m = /^when was the confederation$/i.exec(normalized))) return [`Quand la Confédération canadienne a-t-elle eu lieu ?`, `À quelle période la Confédération du Canada a-t-elle été établie ?`];
  if ((m = /^qui a peint (.+)$/i.exec(normalized))) return [`Quel artiste a peint ${m[1]} ?`, `Qui est l'auteur de la peinture ${m[1]} ?`];
  if ((m = /^que signifie (.+)$/i.exec(normalized))) return [`Comment faut-il comprendre ${m[1]} ?`, `Quelle idée correspond à ${m[1]} ?`];
  if ((m = /^qu['’]est-ce qu['’](un|une) (.+)$/i.exec(normalized))) return [`Comment définit-on ${m[1]} ${m[2]} ?`, `Quelle description correspond à ${m[1]} ${m[2]} ?`];
  if ((m = /^qu['’]est-ce que (.+)$/i.exec(normalized))) return [`Quelle définition correspond à ${m[1]} ?`, `Comment faut-il comprendre ${m[1]} ?`];
  if ((m = /^que se passe-t-il si (.+)$/i.exec(normalized))) return [`Quel résultat suit lorsque ${m[1]} ?`, `Quelle conséquence peut découler du fait que ${m[1]} ?`];
  if ((m = /^à quoi mène (.+)$/i.exec(normalized))) return [`Quel résultat suit ${m[1]} ?`, `Quelle conséquence découle de ${m[1]} ?`];
  if ((m = /^après une élection, quel parti forme le gouvernement$/i.exec(normalized))) return [`Quel parti prend le pouvoir après l’élection ?`, `Quel parti devient le parti au gouvernement après l’élection ?`];
  if ((m = /^(.+?) ont été unis pour créer :?$/i.exec(normalized))) return [`Qu’a produit l’union de ${m[1]} ?`, `Quelle nouvelle entité est issue de l’union de ${m[1]} ?`];
  if ((m = /^(.+?) est aussi appelée? :?$/i.exec(normalized))) return [`Quel autre nom désigne ${m[1]} ?`, `Sous quel nom ${m[1]} est-elle aussi connue ?`];
  if ((m = /^tous les éléments suivants sont inclus dans (.+?) sauf :?$/i.exec(normalized))) return [`Quel élément est exclu de ${m[1]} ?`, `Lequel n’appartient pas à ${m[1]} ?`];
  if ((m = /^(.+?) sont appelés les :?$/i.exec(normalized))) return [`Quel nom collectif désigne ${m[1]} ?`, `Sous quel nom régional ${m[1]} sont-ils regroupés ?`];
  if ((m = /^(.+?) est appelé :?$/i.exec(normalized))) return [`Quel terme désigne ${m[1]} ?`, `Comment nomme-t-on ${m[1]} ?`];
  if ((m = /^le gouvernement fédéral et les provinces partagent la compétence sur :?$/i.exec(normalized))) return [`Quel domaine relève à la fois du fédéral et des provinces ?`, `Dans quel domaine les deux ordres de gouvernement partagent-ils la compétence ?`];
  if ((m = /^les circonscriptions électorales fédérales sont des régions géographiques représentées par un :?$/i.exec(normalized))) return [`Quelle fonction représente une circonscription électorale fédérale ?`, `Quel poste élu représente une circonscription fédérale ?`];
  if ((m = /^le canada compte trois territoires et combien de provinces$/i.exec(normalized))) return [`Combien de provinces y a-t-il en plus des trois territoires ?`, `Quel est le nombre de provinces du Canada ?`];
  if ((m = /^sur quel billet de banque (.+)$/i.exec(normalized))) return [`Quel billet de banque porte l’effigie de ${m[1]} ?`, `Sur quel billet trouve-t-on ${m[1]} ?`];
  if ((m = /^en quelle année (.+)$/i.exec(normalized))) return [`Quelle année correspond à ${m[1]} ?`, `À quelle date se rattache ${m[1]} ?`];
  if ((m = /^qu['’]a-t-on (.+)$/i.exec(normalized))) return [`Quelle mesure a été prise au sujet de ${m[1]} ?`, `Quelle décision concerne ${m[1]} ?`];
  if ((m = /^dans quelle région (.+)$/i.exec(normalized))) return [`Quelle région correspond à la situation décrite par ${m[1]} ?`, `Dans quelle région trouve-t-on ${m[1]} ?`];
  if ((m = /^(quel|quelle|quels|quelles|lequel|laquelle|lesquels|lesquelles) (.+)$/i.exec(normalized))) return [`Quel élément correspond le mieux à ${m[2]} ?`, `Quelle réponse décrit correctement ${m[2]} ?`];
  if ((m = /^quelle (.+)$/i.exec(normalized))) return [`Quel élément correspond à ${m[1]} ?`, `Quelle réponse identifie correctement ${m[1]} ?`];
  if ((m = /^qui a (.+)$/i.exec(normalized))) return [`Quelle personne est liée à l'action ${m[1]} ?`, `Quelle figure est reconnue pour avoir ${m[1]} ?`];
  if ((m = /^qui est (.+)$/i.exec(normalized))) return [`Quelle personne correspond au rôle décrit par ${m[1]} ?`, `Quelle figure est associée à ${m[1]} ?`];
  if ((m = /^qui (.+)$/i.exec(normalized))) return [`Quelle personne ou quel groupe est associé à ${m[1]} ?`, `Qui est lié à ${m[1]} ?`];
  if ((m = /^quand (.+)$/i.exec(normalized))) return [`Quelle date ou période correspond à ${m[1]} ?`, `À quel moment ${m[1]} a-t-il lieu ?`];
  if ((m = /^où (.+)$/i.exec(normalized))) return [`Quel lieu correspond à ${m[1]} ?`, `Dans quel endroit ${m[1]} se produit-il ?`];
  if ((m = /^pourquoi (.+)$/i.exec(normalized))) return [`Quelle raison explique ${m[1]} ?`, `Quelle explication rend compte de ${m[1]} ?`];
  if ((m = /^(quel|quelle|quels|quelles) (.+?) (est|sont|était|étaient) (.+)$/i.exec(normalized))) return [`Identifiez l’élément ${m[2]} qui ${m[3]} ${m[4]}.`, `Quel élément correspond à ${m[2]} ${m[4]} ?`];
  if ((m = /^(quel|quelle|quels|quelles) (.+?) (a|ont|peut|peuvent|doit|doivent) (.+)$/i.exec(normalized))) return [`Identifiez l’élément ${m[2]} qui ${m[3]} ${m[4]}.`, `Quel ${m[2]} correspond à l’action ${m[3]} ${m[4]} ?`];
  if ((m = /^(quel|quelle|quels|quelles) (.+)$/i.exec(normalized))) return [`Quel élément correspond à ${m[2]} ?`, `Identifiez la réponse qui convient à ${m[2]} ?`];
  if ((m = /^qu['’]est-ce qu['’] (.+)$/i.exec(normalized))) return [`Comment faut-il comprendre ${m[1]} ?`, `Quelle définition correspond à ${m[1]} ?`];
  if ((m = /^que (.+)$/i.exec(normalized))) return [`Quel fait décrit le mieux ${m[1]} ?`, `Quelle information faut-il retenir au sujet de ${m[1]} ?`];
  if ((m = /^depuis quand (.+)$/i.exec(normalized))) return [`À partir de quelle date ou période ${m[1]} ?`, `Quand la situation décrite par ${m[1]} a-t-elle commencé ?`];
  if ((m = /^comment (.+)$/i.exec(normalized))) return [`Quelle description explique comment ${m[1]} ?`, `Quelle méthode ou quel processus correspond à ${m[1]} ?`];
  if ((m = /^terre-neuve-et-labrador, l['’]île-du-prince-édouard, la nouvelle-écosse et le nouveau-brunswick sont appelées les :?$/i.exec(normalized))) return [`Quel nom collectif désigne ces quatre provinces de l'Atlantique ?`, `Sous quelle appellation ces quatre provinces sont-elles regroupées ?`];
  if ((m = /^lorsque vous êtes appelé à le faire, faire partie d['’]un jury est :?$/i.exec(normalized))) return [`Comment qualifie-t-on le fait de siéger à un jury lorsqu'on y est convoqué ?`, `Quel statut donne-t-on au service de jury au Canada ?`];
  if ((m = /^lorsqu['’]on est appelé à le faire, faire partie d['’]un jury est une :?$/i.exec(normalized))) return [`Comment qualifie-t-on le fait de siéger à un jury lorsqu'on y est convoqué ?`, `Quel statut donne-t-on au service de jury au Canada ?`];
  if ((m = /^voter aux élections est :?$/i.exec(normalized))) return [`Comment le vote aux élections est-il considéré parmi les responsabilités civiques ?`, `Quel rôle le fait de voter joue-t-il dans la vie citoyenne ?`];
  if ((m = /^en plus de travailler dans l['’]armée, quelles sont d['’]autres façons d['’]aider le canada$/i.exec(normalized))) return [`Par quels autres moyens les Canadiens peuvent-ils contribuer au pays en dehors de l'armée ?`, `Quelles formes de service envers le Canada existent en dehors de la carrière militaire ?`];
  if ((m = /^les sénateurs sont-ils élus ou nommés$/i.exec(normalized))) return [`Comment les sénateurs du Canada accèdent-ils à leur fonction ?`, `Quel mode de désignation s'applique aux sénateurs canadiens ?`];
  if ((m = /^selon le guide d['’]étude officiel, en combien de circonscriptions électorales le canada est-il divisé$/i.exec(normalized))) return [`Combien de circonscriptions électorales fédérales composent le Canada ?`, `Quel est le nombre de circonscriptions électorales fédérales du Canada ?`];
  if ((m = /^pouvez-vous quand même voter si votre nom ne figure pas sur la liste électorale, le jour de l['’]élection$/i.exec(normalized))) return [`Quel recours existe pour un électeur dont le nom n'apparaît pas sur la liste le jour du vote ?`, `Que peut faire un électeur absent de la liste électorale le jour de l'élection ?`];
  if ((m = /^l['’]économie du canada comprend quelles trois principales industries$/i.exec(normalized))) return [`Quels sont les trois grands secteurs industriels de l'économie canadienne ?`, `Quelles industries principales composent l'économie du Canada ?`];
  if ((m = /^les acadiens sont les descendants de colons français qui se sont établis où$/i.exec(normalized))) return [`Dans quelle région les colons français à l'origine des Acadiens se sont-ils établis ?`, `Quel territoire est associé aux premiers établissements acadiens ?`];
  if ((m = /^à combien de questions devez-vous répondre correctement pour réussir l['’]examen de citoyenneté canadienne$/i.exec(normalized))) return [`Combien de bonnes réponses sont nécessaires pour réussir le test de citoyenneté ?`, `Quel score minimal faut-il atteindre au test de citoyenneté canadienne ?`];
  if ((m = /^nommez deux libertés fondamentales protégées par la charte canadienne des droits et libertés$/i.exec(normalized))) return [`Quelles sont deux libertés fondamentales garanties par la Charte canadienne ?`, `Citez deux libertés protégées par la Charte canadienne des droits et libertés.`];
  if ((m = /^à quoi ressemble le drapeau canadien$/i.exec(normalized))) return [`Quels éléments visuels caractérisent le drapeau du Canada ?`, `Comment décrire l'apparence du drapeau canadien ?`];
  if ((m = /^dans quel secteur d['’]activité travaille la majorité des canadiens$/i.exec(normalized))) return [`Dans quel secteur économique travaille la plus grande part des Canadiens ?`, `Quel secteur emploie la majorité de la population active canadienne ?`];
  if ((m = /^qu['’]était le « chemin de fer clandestin »$/i.exec(normalized))) return [`Comment décrire le réseau connu sous le nom de « chemin de fer clandestin » ?`, `Quel rôle jouait le « chemin de fer clandestin » dans l'histoire nord-américaine ?`];
  if ((m = /^qu['’]était le mouvement pour le suffrage des femmes$/i.exec(normalized))) return [`Quel était l'objectif du mouvement pour le suffrage des femmes ?`, `Pour quelle cause le mouvement en faveur du suffrage des femmes militait-il ?`];
  if ((m = /^« a mari usque ad mare » est la devise des armoiries du canada, qui signifie :$/i.exec(normalized))) return [`Que signifie la devise canadienne « A Mari Usque Ad Mare » ?`, `Quelle idée exprime la devise des armoiries du Canada ?`];
  if ((m = /^en 1949, quelle province a été la dernière à se joindre au canada$/i.exec(normalized))) return [`Quelle province a rejoint le Canada en dernier, en 1949 ?`, `Quelle province est devenue canadienne en 1949 et a été la dernière à entrer dans la Confédération ?`];
  if ((m = /^si on vous le demande, à qui devez-vous dire pour qui vous avez voté lors d['’]une élection fédérale$/i.exec(normalized))) return [`À qui, le cas échéant, un électeur doit-il révéler son choix lors d'une élection fédérale ?`, `Quelle règle s'applique à la confidentialité du vote fédéral ?`];
  if ((m = /^dans le système de justice du canada, que signifie la « présomption d['’]innocence »$/i.exec(normalized))) return [`Comment la présomption d'innocence protège-t-elle une personne au Canada ?`, `Quel principe juridique exprime la présomption d'innocence ?`];
  if ((m = /^après une élection fédérale, quel parti forme le nouveau gouvernement$/i.exec(normalized))) return [`Quel parti forme le gouvernement fédéral après une élection ?`, `Comment détermine-t-on le parti qui formera le nouveau gouvernement fédéral ?`];
  if ((m = /^à quelle compagnie le roi charles ii a-t-il permis de chercher de la fourrure$/i.exec(normalized))) return [`Quelle compagnie a reçu de Charles II le droit de rechercher des fourrures ?`, `À quelle entreprise royale le monopole de la recherche de fourrures a-t-il été accordé ?`];
  if ((m = /^la tour de la paix, un élément marquant de la colline du parlement à ottawa, a été achevée en 1927 pour commémorer quel groupe précis de personnes$/i.exec(normalized))) return [`Qui la Tour de la Paix commémore-t-elle ?`, `Quel groupe de personnes est honoré par la Tour de la Paix ?`];
  if ((m = /^l['’]alberta est reconnue comme le plus grand producteur de pétrole et de gaz au canada, principalement en raison de ses vastes réserves de quelle ressource naturelle$/i.exec(normalized))) return [`Quelle ressource naturelle explique l'importance des réserves pétrolières et gazières de l'Alberta ?`, `À quelle ressource les grandes réserves énergétiques de l'Alberta sont-elles liées ?`];
  if ((m = /^le terme « grande charte des libertés » désigne historiquement quel document fondateur signé en 1215 qui a établi des principes juridiques clés en angleterre et a influencé les cadres des droits au canada$/i.exec(normalized))) return [`Quel document anglais de 1215 est associé à la « Grande Charte des libertés » ?`, `Quel texte fondateur signé en 1215 a influencé certaines traditions de droits au Canada ?`];
  if ((m = /^qu['’]était le statut de westminster de 1931$/i.exec(normalized))) return [`Quel rôle le Statut de Westminster de 1931 a-t-il joué dans l'évolution constitutionnelle du Canada ?`, `Pourquoi le Statut de Westminster de 1931 est-il important pour le Canada ?`];
  if ((m = /^au cours de quelle guerre le canada s['’]est-il imposé comme un acteur clé sur la scène mondiale, gagnant le respect international$/i.exec(normalized))) return [`Quelle guerre a contribué à accroître la reconnaissance internationale du Canada ?`, `Lors de quel conflit le Canada a-t-il gagné une plus grande reconnaissance sur la scène mondiale ?`];
  if ((m = /^(.+?) :?$/i.exec(normalized)) && /^(le|la|les|un|une|des|tous|au|en|selon|obtenir|faire|aider|hommes|femmes|canada|dans|depuis)/i.test(normalized)) {
    const topic = m[1].replace(/:\s*$/, '').trim();
    return [`Quelle idée complète correctement l’énoncé sur ${topic} ?`, `Quel fait essentiel complète l’énoncé sur ${topic} ?`];
  }
  return null;
}

function rewriteFrench(text, seed) {
  const body = cleanBody(text);
  const variants = [];
  let m;
  const structural = rewriteFrenchFallback(body);
  if (structural) return pickVariant(body, structural, seed, 'fr').replace(/\?+/g, '?');
  if (/_{2,}/.test(text)) {
    const core = body.replace(/_+/g, '_____');
    variants.push(`Quelle option complète l’énoncé suivant : ${core} ?`, `Quel choix convient à la partie manquante : ${core} ?`);
  } else if ((m = /^de combien de temps disposez-vous pour (.+)$/i.exec(body))) {
    variants.push(`Quelle limite de temps s’applique à ${m[1]} ?`, `Combien de temps est accordé pour ${m[1]} ?`);
  } else if ((m = /^pour devenir (.+?), vous devez fournir une preuve que vous parlez et écrivez en:?$/i.exec(body))) {
    variants.push(`Quelle compétence linguistique un demandeur doit-il démontrer pour ${m[1]} ?`, `Quelle exigence linguistique est décrite pour ${m[1]} ?`);
  } else if ((m = /^à quoi fait référence (.+)$/i.exec(body))) {
    variants.push(`Quelle définition correspond à ${m[1]} ?`, `Quelle explication donne le sens de ${m[1]} ?`);
  } else if ((m = /^qu['’]a fait (.+)$/i.exec(body))) {
    variants.push(`Quelle action a été accomplie par ${m[1]} ?`, `Quelle action est associée à ${m[1]} ?`);
  } else if ((m = /^qu['’]est-il arrivé (?:à|aux) (.+)$/i.exec(body))) {
    variants.push(`Quel événement a touché ${m[1]} ?`, `Quelles conséquences ont concerné ${m[1]} ?`);
  } else if ((m = /^qu['’]a accepté (.+)$/i.exec(body))) {
    variants.push(`Quel engagement ${m[1]} a-t-il pris ?`, `Quelle mesure a été acceptée par ${m[1]} ?`);
  } else if ((m = /^d['’]où provient (.+)$/i.exec(body))) {
    variants.push(`Quelle est l’origine de ${m[1]} ?`, `Quelle origine est associée à ${m[1]} ?`);
  } else if ((m = /^en quoi consiste (.+)$/i.exec(body))) {
    variants.push(`Que signifie ${m[1]} ?`, `Quelle description correspond à ${m[1]} ?`);
  } else if ((m = /^qu['’]est-ce qu['’](un|une) (.+)$/i.exec(body))) {
    variants.push(`Comment définit-on ${m[1]} ${m[2]} ?`, `Quelle description correspond à ${m[1]} ${m[2]} ?`);
  } else if ((m = /^(quel|quelle|quels|quelles|lequel|laquelle|lesquels|lesquelles) (.+)$/i.exec(body))) {
    variants.push(`Quel élément correspond le mieux à ${m[2]} ?`, `Quelle réponse décrit correctement ${m[2]} ?`);
  } else if ((m = /^qu['’]a-t-on (.+)$/i.exec(body))) {
    variants.push(`Quelle mesure a été prise au sujet de ${m[1]} ?`, `Quelle décision concerne ${m[1]} ?`);
  } else if ((m = /^pour quoi (.+)$/i.exec(body))) {
    variants.push(`Pour quelle raison ${m[1]} ?`, `Quelle raison explique ${m[1]} ?`);
  } else if ((m = /^combien (.+)$/i.exec(body))) {
    const x = m[1].replace(/\?+$/, '').trim();
    const v = /^(.*?)\s+(y a-t-il|sont|étaient|ont|avaient|font|vivent|vivaient)\s+(.+)$/i.exec(x);
    variants.push(v ? `Quel est le nombre de ${v[1]} ${v[3]} ?` : `Quel est le nombre exact de ${x} ?`);
  } else if ((m = /^quel(?:le|s)? (.+?) est un exemple de (.+)$/i.exec(body))) {
    variants.push(`Quelle option illustre correctement ${m[2]} ?`, `Quel choix constitue un exemple de ${m[2]} ?`);
  } else if ((m = /^quel est le (.+)$/i.exec(body))) {
    variants.push(`Quelle option identifie correctement le ${m[1]} ?`, `Quelle description correspond au ${m[1]} ?`);
  } else if ((m = /^quelle est la (.+)$/i.exec(body))) {
    variants.push(`Quelle option identifie correctement la ${m[1]} ?`, `Quelle description correspond à la ${m[1]} ?`);
  } else if ((m = /^quel est un (.+)$/i.exec(body))) {
    variants.push(`Quelle option donne un exemple de ${m[1]} ?`, `Quel choix correspond à un ${m[1]} ?`);
  } else if ((m = /^quels sont les (.+)$/i.exec(body)) || (m = /^quelles sont les (.+)$/i.exec(body))) {
    variants.push(`Quel ensemble décrit correctement les ${m[1]} ?`, `Quelle option présente les ${m[1]} ?`);
  } else if ((m = /^qu'est-ce qu'un (.+)$/i.exec(body)) || (m = /^qu’est-ce qu’un (.+)$/i.exec(body))) {
    variants.push(`Quelle définition correspond à un ${m[1]} ?`, `Comment faut-il définir un ${m[1]} ?`);
  } else if ((m = /^qu'est-ce que (.+)$/i.exec(body)) || (m = /^qu’est-ce que (.+)$/i.exec(body))) {
    variants.push(`Quelle définition correspond à ${m[1]} ?`, `Quelle explication donne le sens de ${m[1]} ?`);
  } else if ((m = /^qu['’]ont fait (.+)$/i.exec(body))) {
    variants.push(`Quelle action ${m[1]} ont-ils accomplie ?`, `Quelle action est associée à ${m[1]} ?`);
  } else if ((m = /^qui (?:était|étaient|a|ont|est|sont) (.+)$/i.exec(body))) {
    variants.push(`Quelle personne ou quel groupe est associé à ${m[1]} ?`, `Quel individu ou groupe est décrit par ${m[1]} ?`);
  } else if ((m = /^quelle ville (.+?) a-t-il (.+)$/i.exec(body))) {
    variants.push(`Quelle ville a été ${m[2]} par ${m[1]} ?`, `Quelle ville est associée à l’action de ${m[1]} : ${m[2]} ?`);
  } else if ((m = /^quel(le)? (province|territoire|année|date) (.+?) (?:a-t-il|a-t-elle|est-il|est-elle) (.+)$/i.exec(body))) {
    variants.push(`Quelle ${m[2]} correspond à ${m[3]} ?`, `Quelle option identifie la ${m[2]} liée à ${m[3]} ?`);
  } else if ((m = /^quelle action (.+?) a-t-il (.+)$/i.exec(body))) {
    variants.push(`Quelle action a été accomplie par ${m[1]} ?`, `Quelle action est associée à ${m[1]} ?`);
  } else if ((m = /^quel (.+?) (?:est|sont) (.+)$/i.exec(body))) {
    variants.push(`Quelle option correspond à ${m[1]} ${m[2]} ?`, `Quel choix identifie correctement ${m[1]} ${m[2]} ?`);
  } else if ((m = /^qui (.+)$/i.exec(body))) {
    variants.push(`Quelle personne ou quel groupe correspond à ${m[1]} ?`, `Quel individu ou groupe est associé à ${m[1]} ?`);
  } else if ((m = /^quand (.+)$/i.exec(body))) {
    variants.push(`Quelle date ou période correspond à ${m[1]} ?`, `Quel moment est associé à ${m[1]} ?`);
  } else if ((m = /^où (.+)$/i.exec(body))) {
    variants.push(`Quel lieu est associé à ${m[1]} ?`, `Quel endroit correspond à ${m[1]} ?`);
  } else if ((m = /^pourquoi (.+)$/i.exec(body))) {
    variants.push(`Quelle raison explique le mieux ${m[1]} ?`, `Quelle explication correspond à ${m[1]} ?`);
  } else if ((m = /^comment (.+)$/i.exec(body))) {
    variants.push(`Quelle proposition explique comment ${m[1]} ?`, `Quelle description présente la manière dont ${m[1]} ?`);
  } else if ((m = /^(quel|quelle|quels|quelles|lequel|laquelle|lesquels|lesquelles)\s+(?:un|une|des|les|la|le)?\s*(.+?)\s+n['’]est pas\b/i.exec(body))) {
    variants.push(`Quel élément n’appartient pas au groupe décrit par ${m[2]} ?`, `Quelle option doit être exclue parmi ${m[2]} ?`);
  } else if ((m = /^(?:quel|quelle|quels|quelles)\s+(.+)$/i.exec(body))) {
    variants.push(`Quelle option correspond correctement à ${m[1]} ?`, `Quel choix convient à ${m[1]} ?`);
  } else if (/^(est|sont|était|étaient|a|ont|peut|peuvent|doit|doivent)\b/i.test(body)) {
    variants.push(`Quelle réponse évalue correctement l’affirmation : ${body} ?`, `Quelle option correspond à l’énoncé suivant : ${body} ?`);
  } else {
    variants.push(rewriteFrenchFallback(body)?.[0] ?? rewriteFrenchBlank(body), rewriteFrenchFallback(body)?.[1] ?? rewriteFrenchBlank(body));
  }
  return pickVariant(body, variants, seed, 'fr').replace(/\?+/g, '?');
}

function conciseFact(question, answer, lang) {
  const q = normalize(question);
  const a = String(answer ?? '').trim();
  if (!a) return '';
  if (lang === 'en') {
    if (q.startsWith('what is the capital') || q.startsWith('what is the capital city')) return `Capital city: ${a}.`;
    if (q.startsWith('who ') || q.startsWith('to whom ')) return `Key person or group: ${a}.`;
    if (q.startsWith('where ')) return `Key location: ${a}.`;
    if (q.startsWith('when ')) return `Key date or period: ${a}.`;
    if (q.startsWith('how many ')) return `Key number: ${a}.`;
    if (q.startsWith('how much ')) return `Key amount: ${a}.`;
    if (q.startsWith('what does ') || q.startsWith('what is ')) return `Key meaning or role: ${a}.`;
    return `Key point: ${a}.`;
  }
  if (q.startsWith('quelle est la capitale') || q.startsWith('quel est la capitale')) return `Capitale : ${a}.`;
  if (q.startsWith('qui ') || q.startsWith('à qui ')) return `Personne ou groupe clé : ${a}.`;
  if (q.startsWith('où ')) return `Lieu clé : ${a}.`;
  if (q.startsWith('quand ')) return `Date ou période clé : ${a}.`;
  if (q.startsWith('combien ')) return `Nombre clé : ${a}.`;
  if (q.startsWith('quel est ') || q.startsWith('quelle est ') || q.startsWith('qu’est-ce que') || q.startsWith("qu'est-ce que")) return `Notion ou rôle clé : ${a}.`;
  return `Point essentiel : ${a}.`;
}

function reorderOptions(options, correctIndex, seed, lang, isTf) {
  const clean = options.map(cleanOption);
  if (isTf) {
    const tfOptions = lang === 'en' ? ['True', 'False'] : ['Vrai', 'Faux'];
    return { options: tfOptions, correctIndex: correctIndex === 1 ? 1 : 0 };
  }
  const entries = clean.map((text, index) => ({ text, index }));
  let state = seededNumber(`${seed}|options`);
  for (let i = entries.length - 1; i > 0; i -= 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const j = state % (i + 1);
    [entries[i], entries[j]] = [entries[j], entries[i]];
  }
  return { options: entries.map((x) => x.text), correctIndex: Math.max(0, entries.findIndex((x) => x.index === correctIndex)) };
}

function buildLessonSummary(lesson, lessonQuestionIds, questions, sourceQuestions, lang) {
  const facts = [];
  const seen = new Set();
  for (const id of lessonQuestionIds) {
    const q = questions[id];
    if (!q) continue;
    const sourceQuestion = sourceQuestions[id] ?? q.text;
    const answer = Array.isArray(q.options) ? (q.options[q.correctIndex] ?? '') : '';
    const fact = conciseFact(sourceQuestion, answer, lang);
    const key = normalize(fact);
    if (!fact || seen.has(key)) continue;
    seen.add(key);
    facts.push(fact);
    if (facts.length >= 8) break;
  }
  const headings = (lesson.blocks ?? [])
    .filter((block) => block?.k === 'h' && typeof block?.t === 'string')
    .map((block) => String(block.t).replace(/^#+\\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 5);
  const title = lesson.title;
  const summaryFacts = facts.slice(0, 3);
  const intro = lang === 'en'
    ? `${title} introduces the main ideas to retain for the citizenship test. ${summaryFacts.length ? `In practical terms, focus on ${summaryFacts.join(' ')}.` : 'Use the lesson topics and practice questions to build your recall.'} This is an original study summary, not a reproduction of the source guide.`
    : `« ${title} » présente les principales idées à retenir pour le test de citoyenneté. ${summaryFacts.length ? `En pratique, retenez notamment : ${summaryFacts.join(' ')}` : 'Utilisez les thèmes et les questions pour renforcer votre mémoire.'} Cette synthèse est originale et ne reproduit pas le guide source.`;
  return [
    { k: 'h', t: lang === 'en' ? 'Section summary' : 'Résumé de la section' },
    { k: 'p', t: intro },
    ...(headings.length ? [{ k: 'h', t: lang === 'en' ? 'Topics covered' : 'Thèmes abordés' }, ...headings.map((t) => ({ k: 'li', t }))] : []),
    ...(facts.length ? [{ k: 'h', t: lang === 'en' ? 'Key ideas' : 'Idées essentielles' }, ...facts.map((t) => ({ k: 'li', t }))] : []),
  ];
}

function regionalKey(row) {
  const ids = row.en.jurisdictionIds ?? [];
  return ids.length === 1 ? ids[0] : '';
}
function answersMatch(rowA, rowB) {
  const a = normalize(rowA.en.options[rowA.en.correctIndex] ?? '');
  const b = normalize(rowB.en.options[rowB.en.correctIndex] ?? '');
  const af = normalize(rowA.fr.options[rowA.fr.correctIndex] ?? '');
  const bf = normalize(rowB.fr.options[rowB.fr.correctIndex] ?? '');
  return a === b && af === bf;
}
function isRewrittenDuplicate(rowA, rowB) {
  if (rowA.en.type !== rowB.en.type) return false;
  if (regionalKey(rowA) !== regionalKey(rowB)) return false;
  if (!answersMatch(rowA, rowB)) return false;
  return textSimilarity(rowA.en.text, rowB.en.text) >= 0.9 && textSimilarity(rowA.fr.text, rowB.fr.text) >= 0.9;
}
function mergeRewrittenRows(rows) {
  const merged = [];
  let removed = 0;
  for (const row of rows) {
    const found = merged.findIndex((candidate) => isRewrittenDuplicate(candidate, row));
    const rowLessons = row.group.members.map((member) => member.lessonId == null ? null : Number(member.lessonId)).filter((id) => id != null);
    const rowSources = row.group.members.map((member) => String(member.id));
    if (found < 0) {
      merged.push({ ...row, sourceIds: rowSources, lessonIds: [...new Set(rowLessons)] });
      continue;
    }
    const target = merged[found];
    target.sourceIds.push(...rowSources);
    target.lessonIds = [...new Set([...target.lessonIds, ...rowLessons])];
    if (row.en.access === 'free') {
      target.en.access = 'free';
      target.fr.access = 'free';
    }
    removed += 1;
  }
  return { rows: merged, removed };
}
function ensureUniqueQuestionTexts(rows) {
  const seenEn = new Set();
  const seenFr = new Set();
  for (const row of rows) {
    const originalEn = normalize(row.en.text);
    const originalFr = normalize(row.fr.text);
    if (!seenEn.has(originalEn) && !seenFr.has(originalFr)) {
      seenEn.add(originalEn);
      seenFr.add(originalFr);
      continue;
    }
    const baseSeed = Number(row.group.representative.id);
    let changed = false;
    for (let attempt = 1; attempt <= 16 && !changed; attempt += 1) {
      const seed = baseSeed + attempt * 100003;
      const enCandidate = row.en.type === 'tf' ? rewriteTf(row.group.representative.text, 'en', seed) : rewriteEnglish(row.group.representative.text, seed);
      const frSource = row.fr.sourceQuestion ?? row.group.representative.text;
      const frCandidate = row.fr.type === 'tf' ? rewriteTf(frSource, 'fr', seed) : rewriteFrench(frSource, seed);
      if (!seenEn.has(normalize(enCandidate)) && !seenFr.has(normalize(frCandidate))) {
        row.en.text = enCandidate;
        row.fr.text = frCandidate;
        changed = true;
      }
    }
    if (!changed) {
      row.en.text = `${row.en.text} In this lesson, choose the correct answer.`;
      row.fr.text = `${row.fr.text} Dans cette leçon, choisissez la bonne réponse.`;
    }
    seenEn.add(normalize(row.en.text));
    seenFr.add(normalize(row.fr.text));
  }
}

function main() {
  const en = loadBundle('en');
  const fr = loadBundle('fr');
  const enQuestions = Object.values(en.questions ?? {});
  const frQuestions = Object.values(fr.questions ?? {});
  const frById = new Map(frQuestions.map((q) => [String(q.id), q]));
  if (enQuestions.length !== frQuestions.length) throw new Error(`EN/FR question counts differ: ${enQuestions.length} vs ${frQuestions.length}.`);
  for (const q of enQuestions) if (!frById.has(String(q.id))) throw new Error(`Missing FR question ${q.id}.`);

  const groups = deduplicateQuestions(enQuestions);
  const rawRewritten = [];
  for (let n = 0; n < groups.length; n += 1) {
    const rep = groups[n].representative;
    const frRep = frById.get(String(rep.id));
    if (!frRep) throw new Error(`Missing FR representative ${rep.id}.`);
    const type = questionType(rep);
    const isTf = type === 'tf';
    const sourceCorrect = Number.isInteger(rep.correctIndex) ? rep.correctIndex : 0;
    const enOptions = (rep.options ?? []).map(cleanOption);
    const frOptions = (frRep.options ?? []).map(cleanOption);
    const enOrdered = reorderOptions(enOptions, sourceCorrect, rep.id, 'en', isTf);
    const frOrdered = reorderOptions(frOptions, sourceCorrect, rep.id, 'fr', isTf);
    const enText = isTf ? rewriteTf(rep.text, 'en', rep.id) : rewriteEnglish(rep.text, rep.id);
    const frText = isTf ? rewriteTf(frRep.text, 'fr', rep.id) : rewriteFrench(frRep.text, rep.id);
    const lessonId = rep.lessonId == null ? null : Number(rep.lessonId);
    const chapterId = rep.chapterId == null ? null : Number(rep.chapterId);
    const lesson = en.lessons.find((x) => Number(x.id) === lessonId);
    const frLesson = fr.lessons.find((x) => Number(x.id) === lessonId);
    const chapter = en.chapters.find((x) => x.id === chapterId);
    const frChapter = fr.chapters.find((x) => Number(x.id) === chapterId);
    const reg = regionalIds(rep, lesson);
    const sourceEn = { guideTitle: GUIDE_TITLE, title: lesson ? `${chapter?.title ?? 'Discover Canada'} — ${lesson.title}` : GUIDE_TITLE, url: GUIDE_URL, checkedOn: CHECKED_ON };
    const sourceFr = { guideTitle: GUIDE_TITLE, title: frLesson ? `${frChapter?.title ?? 'Découvrir le Canada'} — ${frLesson.title}` : GUIDE_TITLE, url: GUIDE_URL, checkedOn: CHECKED_ON };
    const common = { id: n + 1, conceptId: `canamastery-${n + 1}`, type, correctIndex: enOrdered.correctIndex, origin: lessonId != null ? 'lesson' : 'exam', lessonId, chapterId, inferred: lessonId == null, access: FREE_CHAPTER_IDS.includes(chapterId) ? 'free' : 'premium', regional: reg.length === 1, jurisdictionIds: reg.length === 1 ? reg : undefined };
    const enQ = { ...common, text: enText, options: enOrdered.options, explanation: isTf ? `The study material marks this statement as ${enOrdered.correctIndex === 0 ? 'accurate' : 'inaccurate'}.` : `Key fact to remember: ${enOrdered.options[enOrdered.correctIndex] ?? ''}.`, source: sourceEn };
    const frQ = { ...common, text: frText, options: frOrdered.options, correctIndex: frOrdered.correctIndex, explanation: isTf ? `Le matériel d’étude considère cette affirmation comme ${frOrdered.correctIndex === 0 ? 'exacte' : 'inexacte'}.` : `Fait à retenir : ${frOrdered.options[frOrdered.correctIndex] ?? ''}.`, source: sourceFr };
    rawRewritten.push({ group: groups[n], en: enQ, fr: frQ, lessonId, chapterId });
  }
  const rewrittenDedupe = mergeRewrittenRows(rawRewritten);
  const deduped = rewrittenDedupe.rows.map((row, index) => {
    const id = index + 1;
    row.en.id = id;
    row.en.conceptId = `canamastery-${id}`;
    row.fr.id = id;
    row.fr.conceptId = `canamastery-${id}`;
    return row;
  });
  ensureUniqueQuestionTexts(deduped);

  const sourceToNew = new Map();
  for (const row of deduped) for (const sourceId of row.sourceIds) sourceToNew.set(sourceId, row.en.id);
  const enQuestionsOut = Object.fromEntries(deduped.map((d) => [String(d.en.id), d.en]));
  const frQuestionsOut = Object.fromEntries(deduped.map((d) => [String(d.fr.id), d.fr]));
  const sourceQuestionEn = Object.fromEntries(deduped.map((d) => [String(d.en.id), d.group.representative.text]));
  const sourceQuestionFr = Object.fromEntries(deduped.map((d) => [String(d.fr.id), frById.get(String(d.group.representative.id))?.text ?? d.group.representative.text]));
  const questionByLesson = new Map(en.lessons.map((l) => [Number(l.id), []]));
  for (const d of deduped) for (const lessonId of d.lessonIds) if (questionByLesson.has(lessonId) && !questionByLesson.get(lessonId).includes(d.en.id)) questionByLesson.get(lessonId).push(d.en.id);

  const chapters = en.chapters.map((chapter, index) => ({
    id: Number(chapter.id),
    order: index + 1,
    title: chapter.title,
    lessonIds: en.lessons.filter((l) => Number(l.parentId ?? l.chapterId) === Number(chapter.id)).map((l) => Number(l.id)),
    access: FREE_CHAPTER_IDS.includes(Number(chapter.id)) ? 'free' : 'premium',
    source: { guideTitle: GUIDE_TITLE, title: chapter.title, url: GUIDE_URL, checkedOn: CHECKED_ON },
  }));
  const frChapterById = new Map((fr.chapters ?? []).map((c) => [Number(c.id), c]));
  const lessons = en.lessons.map((lesson, index) => ({
    id: Number(lesson.id),
    chapterId: Number(lesson.chapterId),
    order: Number(lesson.order ?? index + 1),
    title: lesson.title,
    blocks: buildLessonSummary(lesson, questionByLesson.get(Number(lesson.id)) ?? [], enQuestionsOut, sourceQuestionEn, 'en'),
    hasAudio: false,
    questionIds: questionByLesson.get(Number(lesson.id)) ?? [],
    access: FREE_CHAPTER_IDS.includes(Number(lesson.chapterId)) ? 'free' : 'premium',
    regional: false,
    source: { guideTitle: GUIDE_TITLE, title: lesson.title, url: GUIDE_URL, checkedOn: CHECKED_ON },
  }));
  const frLessons = en.lessons.map((lesson, index) => {
    const frLesson = fr.lessons.find((l) => Number(l.id) === Number(lesson.id));
    return {
      id: Number(lesson.id),
      chapterId: Number(lesson.chapterId),
      order: Number(frLesson?.order ?? lesson.order ?? index + 1),
      title: frLesson?.title ?? lesson.title,
      blocks: buildLessonSummary(frLesson ?? lesson, questionByLesson.get(Number(lesson.id)) ?? [], frQuestionsOut, sourceQuestionFr, 'fr'),
      hasAudio: false,
      questionIds: questionByLesson.get(Number(lesson.id)) ?? [],
      access: FREE_CHAPTER_IDS.includes(Number(lesson.chapterId)) ? 'free' : 'premium',
      regional: false,
      source: { guideTitle: GUIDE_TITLE, title: frLesson?.title ?? lesson.title, url: GUIDE_URL, checkedOn: CHECKED_ON },
    };
  });

  const allIds = deduped.map((d) => d.en.id);
  const freeIds = new Set(allIds.filter((id) => deduped[id - 1]?.en.access === 'free'));
  const pick20 = (mapped, pool) => {
    const out = [];
    for (const id of mapped) if (pool.has(id) && !out.includes(id)) { out.push(id); if (out.length === 20) break; }
    for (const id of pool) if (!out.includes(id)) { out.push(id); if (out.length === 20) break; }
    return out;
  };
  const exams = (en.exams ?? []).map((test, index) => {
    const mapped = (test.questionIds ?? []).map((id) => sourceToNew.get(String(id))).filter((id) => Number.isInteger(id));
    const pool = index === 0 ? freeIds : new Set(allIds);
    const ids = pick20(mapped, pool);
    if (ids.length !== 20) throw new Error(`Exam ${test.id} cannot be built with 20 unique questions.`);
    return {
      id: Number(test.id),
      order: index + 1,
      title: test.title,
      kind: test.kind === 'mock' ? 'mock' : 'practice',
      durationMin: 45,
      questionIds: ids,
      access: index === 0 ? 'free' : 'premium',
      source: { guideTitle: GUIDE_TITLE, title: test.title, url: GUIDE_URL, checkedOn: CHECKED_ON },
    };
  });

  const frExams = exams.map((e) => ({ ...e, title: fr.tests?.find((t) => Number(t.id) === e.id)?.title ?? e.title }));
  const glossaryEn = (en.glossary ?? []).map((g) => ({ id: Number(g.id), term: String(g.word ?? g.term ?? '').trim(), definition: String(g.definition ?? '').trim() })).filter((g) => g.term && g.definition);
  const glossaryFr = (fr.glossary ?? []).map((g) => ({ id: Number(g.id), term: String(g.word ?? g.term ?? '').trim(), definition: String(g.definition ?? '').trim() })).filter((g) => g.term && g.definition);
  const build = (lang, questions, lessonRows, chapterRows, examRows, glossary) => ({
    lang,
    sample: false,
    contentVersion: CONTENT_VERSION,
    sourceEdition: GUIDE_TITLE,
    sourceCheckedOn: CHECKED_ON,
    sourceUrl: GUIDE_URL,
    passMark: 15,
    examSize: 20,
    examMinutes: 45,
    freeChapterIds: FREE_CHAPTER_IDS,
    chapters: chapterRows,
    lessons: lessonRows,
    questions,
    exams: examRows,
    glossary,
  });
  const outEn = build('en', enQuestionsOut, lessons, chapters, exams, glossaryEn);
  const outFr = build('fr', frQuestionsOut, frLessons, chapters.map((c) => ({ ...c, title: frChapterById.get(c.id)?.title ?? c.title, source: { ...c.source, title: frChapterById.get(c.id)?.title ?? c.title } })), frExams, glossaryFr);

  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'content.en.json'), JSON.stringify(outEn));
  fs.writeFileSync(path.join(OUT, 'content.fr.json'), JSON.stringify(outFr));

  const rewriteEn = deduped.map((d) => textSimilarity(d.group.representative.text, d.en.text));
  const rewriteFr = deduped.map((d) => textSimilarity((frById.get(String(d.group.representative.id))?.text ?? ''), d.fr.text));
  const regionalCounts = Object.fromEntries(Object.keys(JURISDICTIONS).map((id) => [id, deduped.filter((d) => d.en.regional && d.en.jurisdictionIds?.includes(id)).length]));
  const audit = {
    sourceQuestionCount: enQuestions.length,
    exactDuplicatesRemoved: enQuestions.length - new Set(enQuestions.map((q) => `${questionType(q)}|${normalize(q.text)}|${normalize(correctOption(q))}`)).size,
    nearDuplicatesRemoved: enQuestions.length - new Set(groups.map((g) => g.representative.id)).size - (enQuestions.length - new Set(enQuestions.map((q) => `${questionType(q)}|${normalize(q.text)}|${normalize(correctOption(q))}`)).size),
    duplicatesRemoved: (enQuestions.length - groups.length) + rewrittenDedupe.removed,
    uniqueQuestions: deduped.length,
    rewrittenDuplicatesRemoved: rewrittenDedupe.removed,
    enRewriteSimilarityMax: Number(Math.max(...rewriteEn).toFixed(4)),
    frRewriteSimilarityMax: Number(Math.max(...rewriteFr).toFixed(4)),
    enRewriteSimilarityAbove90: rewriteEn.filter((x) => x >= 0.90).length,
    frRewriteSimilarityAbove90: rewriteFr.filter((x) => x >= 0.90).length,
    rawSourceTextStoredInRuntime: false,
    sourceEdition: GUIDE_TITLE,
    checkedOn: CHECKED_ON,
    freeChapterIds: FREE_CHAPTER_IDS,
    regionalQuestionCount: deduped.filter((d) => d.en.regional).length,
    jurisdictions: regionalCounts,
    editorialReview: 'pending',
  };
  fs.writeFileSync(path.join(OUT, 'content-audit.json'), JSON.stringify(audit, null, 2) + '\n');
  console.log(JSON.stringify(audit, null, 2));
}

main();
