import { create } from 'zustand';
import * as db from '@/lib/db';
import { todayKey } from '@/lib/dates';
import { DEFAULT_MODEL } from '@/lib/gemini';
import { getApiKey, setApiKey } from '@/lib/secrets';
import type { FoodItem, Profile, Recommendation, Slot, ThemePref } from '@/lib/types';

/** A meal being reviewed/edited before it is saved. */
export interface Draft {
  /** Set when editing an already-saved meal. */
  id: string | null;
  createdAt: string | null;
  date: string;
  slot: Slot;
  eatenAt: string;
  photoUri: string | null;
  note: string;
  dishSummary: string;
  items: FoodItem[];
  recommendation: Recommendation | null;
  modelUsed: string | null;
  /** Meal kcal when the recommendation was produced, to detect stale advice. */
  recommendationBasisKcal: number;
}

interface AppState {
  hydrated: boolean;
  profile: Profile | null;
  themePref: ThemePref;
  modelId: string;
  useFallback: boolean;
  apiKey: string | null;
  /** Day shown on the Today tab. */
  selectedDate: string;
  /** Bumped after every meal write so screens reload. */
  dataVersion: number;
  draft: Draft | null;

  hydrate: () => Promise<void>;
  setProfile: (p: Profile) => Promise<void>;
  setThemePref: (t: ThemePref) => Promise<void>;
  setModelId: (m: string) => Promise<void>;
  setUseFallback: (v: boolean) => Promise<void>;
  setApiKey: (k: string) => Promise<void>;
  setSelectedDate: (d: string) => void;
  bumpData: () => void;
  setDraft: (d: Draft | null) => void;
  updateDraft: (patch: Partial<Draft>) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  hydrated: false,
  profile: null,
  themePref: 'system',
  modelId: DEFAULT_MODEL,
  useFallback: true,
  apiKey: null,
  selectedDate: todayKey(),
  dataVersion: 0,
  draft: null,

  hydrate: async () => {
    const [profile, themePref, modelId, useFallback, apiKey] = await Promise.all([
      db.getProfile(),
      db.getSetting('theme'),
      db.getSetting('model'),
      db.getSetting('fallback'),
      getApiKey().catch(() => null),
    ]);
    set({
      hydrated: true,
      profile,
      themePref: (themePref as ThemePref) ?? 'system',
      modelId: modelId ?? DEFAULT_MODEL,
      useFallback: useFallback !== 'false',
      apiKey,
    });
  },
  setProfile: async (p) => {
    await db.saveProfile(p);
    set({ profile: p });
  },
  setThemePref: async (t) => {
    set({ themePref: t });
    await db.setSetting('theme', t);
  },
  setModelId: async (m) => {
    set({ modelId: m });
    await db.setSetting('model', m);
  },
  setUseFallback: async (v) => {
    set({ useFallback: v });
    await db.setSetting('fallback', String(v));
  },
  setApiKey: async (k) => {
    await setApiKey(k);
    set({ apiKey: k.trim() || null });
  },
  setSelectedDate: (d) => set({ selectedDate: d }),
  bumpData: () => set({ dataVersion: get().dataVersion + 1 }),
  setDraft: (d) => set({ draft: d }),
  updateDraft: (patch) => {
    const d = get().draft;
    if (d) set({ draft: { ...d, ...patch } });
  },
}));
