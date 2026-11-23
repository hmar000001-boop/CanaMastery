import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

const KEY = 'canamastery.premium.v1';
interface PremiumState {
  unlocked: boolean;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  unlock: () => Promise<void>;
}
export const usePremium = create<PremiumState>((set) => ({
  unlocked: false,
  hydrated: false,
  hydrate: async () => {
    try { set({ unlocked: (await SecureStore.getItemAsync(KEY)) === '1', hydrated: true }); }
    catch { set({ hydrated: true }); }
  },
  unlock: async () => {
    set({ unlocked: true });
    try { await SecureStore.setItemAsync(KEY, '1'); } catch { /* entitlement remains in memory */ }
  },
}));
