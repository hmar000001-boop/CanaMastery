import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');

const ROOT = process.cwd();
const I18N_DIR = path.join(ROOT, 'src', 'i18n');
const SOURCE_DIRS = [path.join(ROOT, 'app'), path.join(ROOT, 'src')];
const ALLOWED_JSX_TEXT = new Set(['Aa']);

function keyName(node) {
  return ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node) ? node.text : null;
}

function collectObjectKeys(node, prefix, output) {
  if (!ts.isObjectLiteralExpression(node)) return;
  for (const property of node.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    const key = keyName(property.name);
    if (!key) continue;
    const full = prefix ? `${prefix}.${key}` : key;
    output.add(full);
    if (ts.isObjectLiteralExpression(property.initializer)) collectObjectKeys(property.initializer, full, output);
  }
}

function walkFiles(dir, callback) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(file, callback);
    else callback(file);
  }
}

const translations = { en: new Set(), fr: new Set() };
walkFiles(I18N_DIR, (file) => {
  if (!file.endsWith('.ts')) return;
  const source = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && ts.isObjectLiteralExpression(node.initializer)) {
      const name = node.name.text;
      const lang = name === 'en' || name.endsWith('En') ? 'en' : name === 'fr' || name.endsWith('Fr') ? 'fr' : null;
      if (lang) collectObjectKeys(node.initializer, '', translations[lang]);
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
});

const staticUses = [];
const jsxText = [];
for (const dir of SOURCE_DIRS) {
  walkFiles(dir, (file) => {
    if (!/\.(tsx?|jsx?)$/.test(file)) return;
    const source = fs.readFileSync(file, 'utf8');
    const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    function visit(node) {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 't') {
        const first = node.arguments[0];
        if (first && (ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first))) {
          staticUses.push({ file, line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, key: first.text });
        }
      }
      if (ts.isJsxText(node)) {
        const text = node.getText(sf).replace(/\s+/g, ' ').trim();
        if (text && /[A-Za-zÀ-ÿ]/.test(text) && !ALLOWED_JSX_TEXT.has(text)) {
          jsxText.push({ file, line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, text });
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(sf);
  });
}

const hasKey = (set, key) => set.has(key) || set.has(`${key}_one`) || set.has(`${key}_other`) || set.has(`${key}_many`) || set.has(`${key}_few`) || set.has(`${key}_zero`);
const missingEn = staticUses.filter((use) => !hasKey(translations.en, use.key));
const missingFr = staticUses.filter((use) => !hasKey(translations.fr, use.key));

const enOnly = [...translations.en].filter((key) => !translations.fr.has(key));
const frOnly = [...translations.fr].filter((key) => !translations.en.has(key));

if (missingEn.length || missingFr.length || enOnly.length || frOnly.length || jsxText.length) {
  for (const item of missingEn) console.error(`Missing EN key: ${path.relative(ROOT, item.file)}:${item.line} ${item.key}`);
  for (const item of missingFr) console.error(`Missing FR key: ${path.relative(ROOT, item.file)}:${item.line} ${item.key}`);
  for (const key of enOnly) console.error(`EN-only translation key: ${key}`);
  for (const key of frOnly) console.error(`FR-only translation key: ${key}`);
  for (const item of jsxText) console.error(`Hardcoded UI text: ${path.relative(ROOT, item.file)}:${item.line} ${JSON.stringify(item.text)}`);
  process.exit(1);
}

console.log(`i18n OK: ${translations.en.size} EN keys / ${translations.fr.size} FR keys; ${staticUses.length} static translation calls checked; no hardcoded UI text.`);
