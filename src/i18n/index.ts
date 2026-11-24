import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import type { Lang } from '../types';
import { en } from './en';
import { examEn, examFr } from './exam';
import { focusEn, focusFr } from './focus';
import { fr } from './fr';
import { glossaryEn, glossaryFr } from './glossary';
import { homeEn, homeFr } from './home';
import { learnEn, learnFr } from './learn';
import { lessonEn, lessonFr } from './lesson';
import { moreEn, moreFr } from './more';
import { remindersEn, remindersFr } from './reminders';
import { screensEn, screensFr } from './screens';
import { settingsUxEn, settingsUxFr } from './settingsUx';
import { uiEn, uiFr } from './ui';
import { commercialEn, commercialFr } from './commercial';

export function deviceLang(): Lang {
  return getLocales()[0]?.languageCode === 'fr' ? 'fr' : 'en';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function mergeTranslations(...sources: Record<string, unknown>[]): Record<string, unknown> {
  return sources.reduce<Record<string, unknown>>((result, source) => {
    for (const [key, value] of Object.entries(source)) {
      const current = result[key];
      result[key] = isRecord(current) && isRecord(value)
        ? mergeTranslations(current, value)
        : value;
    }
    return result;
  }, {});
}

const resources = {
  en: { translation: mergeTranslations(en, learnEn, screensEn, uiEn, examEn, homeEn, moreEn, lessonEn, glossaryEn, remindersEn, focusEn, settingsUxEn, commercialEn) },
  fr: { translation: mergeTranslations(fr, learnFr, screensFr, uiFr, examFr, homeFr, moreFr, lessonFr, glossaryFr, remindersFr, focusFr, settingsUxFr, commercialFr) },
};

if (!i18n.isInitialized) {
  // i18next exposes `use` both as a default-instance method and a named export.
  // eslint-disable-next-line import/no-named-as-default-member
  void i18n.use(initReactI18next).init({ resources, lng: deviceLang(), fallbackLng: 'en', interpolation: { escapeValue: false } });
}

export default i18n;
