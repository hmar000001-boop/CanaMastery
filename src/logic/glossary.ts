import type { GlossaryTerm } from '../types';

function toSearchText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';
  try {
    return String(value);
  } catch {
    // Malformed content must not be able to crash lesson rendering.
    return '';
  }
}

const fold = (value: unknown): string => {
  const text = toSearchText(value);
  let normalized = text;
  try {
    // Access the built-in method defensively: some older JS runtimes may not
    // expose Unicode normalization, and content values may be absent.
    const normalize = String.prototype?.normalize;
    if (typeof normalize === 'function') normalized = normalize.call(text, 'NFD');
  } catch {
    // Keep the original text when Unicode normalization is unavailable.
  }
  return normalized
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[’‘]/g, "'");
};

export const normalizeSearch = (value: unknown): string => fold(value).replace(/\s+/g, ' ').trim();

function isGlossaryTerm(value: unknown): value is GlossaryTerm {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<GlossaryTerm>;
  return typeof candidate.term === 'string' && typeof candidate.definition === 'string';
}

export function searchGlossary(terms: readonly GlossaryTerm[] | null | undefined, query: unknown, lang: string): GlossaryTerm[] {
  const entries = Array.isArray(terms) ? terms.filter(isGlossaryTerm) : [];
  const q = normalizeSearch(query);
  return entries
    .filter((term) => !q || normalizeSearch(term.term).includes(q) || normalizeSearch(term.definition).includes(q))
    .sort((a, b) => a.term.localeCompare(b.term, lang, { sensitivity: 'base' }));
}

export interface TermMatch { start: number; end: number; term: GlossaryTerm; }
export type GlossaryMatcher = (text: string) => TermMatch[];

export function makeGlossaryMatcher(terms: readonly GlossaryTerm[] | null | undefined): GlossaryMatcher {
  const byName = new Map<string, GlossaryTerm>();
  const entries: unknown[] = Array.isArray(terms) ? terms : [];
  for (const candidate of entries) {
    if (typeof candidate !== 'object' || candidate === null) continue;
    const term = candidate as Partial<GlossaryTerm>;
    if (typeof term.term !== 'string') continue;
    const name = normalizeSearch(term.term);
    if (name && !byName.has(name)) byName.set(name, term as GlossaryTerm);
  }
  const special = new Set(['\\', '^', '$', '.', '*', '+', '?', '(', ')', '[', ']', '{', '}', '|']);
  const escape = (s: string) => Array.from(s).map((c) => special.has(c) ? '\\' + c : c).join('').replace(/ /g, '\\s+');
  const names = [...byName.keys()].sort((a, b) => b.length - a.length);
  if (!names.length) return () => [];
  const pattern = '(^|[^\\p{L}\\p{N}_])(' + names.map(escape).join('|') + ')(?![\\p{L}\\p{N}_])';
  return (text) => {
    const safeText = toSearchText(text);
    let normalized = '';
    let offset = 0;
    const starts: number[] = [];
    const ends: number[] = [];
    for (const char of safeText) {
      const part = fold(char);
      for (let i = 0; i < part.length; i += 1) { starts.push(offset); ends.push(offset + char.length); }
      if (!part.length && ends.length) ends[ends.length - 1] = offset + char.length;
      normalized += part;
      offset += char.length;
    }
    const regex = new RegExp(pattern, 'gu');
    const out: TermMatch[] = [];
    for (const match of normalized.matchAll(regex)) {
      const start = (match.index ?? 0) + match[1].length;
      const end = start + match[2].length;
      const term = byName.get(normalizeSearch(match[2]));
      if (term && starts[start] !== undefined && ends[end - 1] !== undefined) out.push({ start: starts[start], end: ends[end - 1], term });
    }
    return out;
  };
}

export interface RichSegment { text: string; bold: boolean; term?: GlossaryTerm; }

export function richSegments(text: string, matcher?: GlossaryMatcher): RichSegment[] {
  const source = toSearchText(text);
  let plain = '';
  const bold: { start: number; end: number }[] = [];
  source.split('**').forEach((part, i) => {
    const start = plain.length;
    plain += part;
    if (i % 2 === 1) bold.push({ start, end: plain.length });
  });
  const matches = matcher?.(plain) ?? [];
  const cuts = [...new Set([0, plain.length, ...bold.flatMap((b) => [b.start, b.end]), ...matches.flatMap((m) => [m.start, m.end])])].sort((a, b) => a - b);
  const out: RichSegment[] = [];
  for (let i = 0; i + 1 < cuts.length; i += 1) {
    const start = cuts[i];
    const end = cuts[i + 1];
    if (start === end) continue;
    out.push({ text: plain.slice(start, end), bold: bold.some((b) => b.start <= start && b.end >= end), term: matches.find((m) => m.start <= start && m.end >= end)?.term });
  }
  return out;
}
