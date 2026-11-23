import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { DEFAULT_LEARNING_LEVEL, normalizeLearningLevel, type LearningLevel } from '../logic/learningLevels';
import type { JurisdictionId, Lang } from '../types';

export type ThemeMode = 'system' | 'light' | 'dark';
interface SettingsState {
  lang: Lang | null; onboarded: boolean; jurisdictionId: JurisdictionId | null; examDate: string | null; dailyGoalMin: number; reduceMotion: boolean; haptics: boolean; themeMode: ThemeMode; textScale: number;
  quizLevel: LearningLevel;
  setLang: (lang: Lang) => void; setJurisdictionId: (id: JurisdictionId) => void; setExamDate: (day: string | null) => void; setDailyGoal: (minutes: number) => void; setReduceMotion: (value: boolean) => void; setHaptics: (value: boolean) => void; setThemeMode: (mode: ThemeMode) => void; setTextScale: (scale: number) => void;
  setQuizLevel: (level: LearningLevel) => void;
  completeOnboarding: (p: { lang: Lang; jurisdictionId: JurisdictionId; examDate: string | null; dailyGoalMin: number }) => void;
}
export const useSettings = create<SettingsState>()(persist((set) => ({
  lang: null, onboarded: false, jurisdictionId: null, examDate: null, dailyGoalMin: 20, reduceMotion: false, haptics: true, themeMode: 'system', textScale: 1,
  quizLevel: DEFAULT_LEARNING_LEVEL,
  setLang: (lang) => set({ lang }), setJurisdictionId: (jurisdictionId) => set({ jurisdictionId }), setExamDate: (examDate) => set({ examDate }), setDailyGoal: (dailyGoalMin) => set({ dailyGoalMin }), setReduceMotion: (reduceMotion) => set({ reduceMotion }), setHaptics: (haptics) => set({ haptics }), setThemeMode: (themeMode) => set({ themeMode }), setTextScale: (textScale) => set({ textScale }), completeOnboarding: (p) => set({ ...p, onboarded: true }),
  setQuizLevel: (quizLevel) => set({ quizLevel: normalizeLearningLevel(quizLevel) }),
}), {
  name: 'settings-v2', version: 3, storage: createJSONStorage(() => AsyncStorage),
  migrate: (persisted) => {
    const saved = (persisted ?? {}) as Partial<SettingsState>;
    return { ...saved, jurisdictionId: saved.jurisdictionId ?? null, quizLevel: normalizeLearningLevel(saved.quizLevel) } as SettingsState;
  },
  merge: (persisted, current) => {
    const saved = (persisted ?? {}) as Partial<SettingsState>;
    return { ...current, ...saved, jurisdictionId: saved.jurisdictionId ?? null, quizLevel: normalizeLearningLevel(saved.quizLevel) };
  },
}));
