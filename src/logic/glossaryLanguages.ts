import type { GlossaryTerm } from '../types';
import { normalizeSearch } from './glossary';

export const GLOSSARY_LANGUAGES = ['fr', 'en'] as const;
export type GlossaryLanguage = typeof GLOSSARY_LANGUAGES[number];
export function glossaryLanguage(value: unknown): GlossaryLanguage { return value === 'fr' || value === 'en' ? value : 'en'; }
export interface GlossaryDisplay { source: GlossaryTerm; term: string; definition: string; rtl: boolean; missing: boolean; searchText: string; }
export function normalizeGlossaryQuery(value: string): string { return normalizeSearch(value); }

export function translateGlossaryTerm(source: GlossaryTerm, language: GlossaryLanguage, native: { fr?: GlossaryTerm; en?: GlossaryTerm }): GlossaryDisplay {
  const selected = native[language];
  const result = selected ?? source;
  return { source, term: result.term, definition: result.definition, rtl: false, missing: !selected, searchText: normalizeGlossaryQuery([source.term, source.definition, native.fr?.term, native.en?.term, result.term, result.definition].filter(Boolean).join(' ')) };
}
export function matchesGlossaryDisplay(display: GlossaryDisplay, query: string): boolean { return display.searchText.includes(normalizeGlossaryQuery(query)); }
