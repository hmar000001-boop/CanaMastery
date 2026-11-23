import type { ContentBundle, Lang } from '../types';
import { contentEn } from './generated/content.en';
import { contentFr } from './generated/content.fr';

const raw: Record<Lang, ContentBundle> = { fr: contentFr, en: contentEn };
const kinds = new Map(raw.en.exams.map((e) => [e.id, e.kind]));

const bundles: Record<Lang, ContentBundle> = {
  en: raw.en,
  fr: { ...raw.fr, exams: raw.fr.exams.map((e) => ({ ...e, kind: kinds.get(e.id) ?? e.kind })) },
};

export function getBundle(lang: Lang): ContentBundle { return bundles[lang]; }
