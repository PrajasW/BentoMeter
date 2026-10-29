import { create } from 'zustand';
import * as db from '@/lib/db';
import { todayKey } from '@/lib/dates';
import { DEFAULT_MODEL } from '@/lib/gemini';

/** Model ids the app used to offer; saved ones move to the current default. Custom ids are kept. */
const RETIRED_MODELS = new Set(['gemini-pro-latest', 'gemini-3.1-pro-preview', 'gemini-3.8-flash', 'gemini-3.5-flash']);
import { releaseLocalModel } from '@/lib/local/llm';
import { cancelDownload, deleteModel, downloadModel, isModelReady, type ModelStatus } from '@/lib/local/modelManager';
import type { MessContext } from '@/lib/mess';
import { getApiKey, getDiningKey, setApiKey, setDiningKey } from '@/lib/secrets';
import type { FoodItem, Profile, Recommendation, Slot, ThemePref } from '@/lib/types';

/** Which analyzer runs first; the other options are offered when it fails. */
export type Engine = 'gemini' | 'local';

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
  /** IIIT-H mess menu chosen on the capture screen, reused by handoff and refresh. */
  mess?: MessContext | null;
}

interface AppState {
  hydrated: boolean;
  profile: Profile | null;
  themePref: ThemePref;
  modelId: string;
  useFallback: boolean;
  apiKey: string | null;
  engine: Engine;
  localModel: ModelStatus;
  /** Show the IIIT-H mess option when logging meals. */
  messEnabled: boolean;
  diningKey: string | null;
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
  setEngine: (e: Engine) => Promise<void>;
  setMessEnabled: (v: boolean) => Promise<void>;
  setDiningKey: (k: string) => Promise<void>;
  downloadLocalModel: () => Promise<void>;
  cancelLocalDownload: () => void;
  deleteLocalModel: () => Promise<void>;
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
  engine: 'gemini',
  localModel: { state: 'none' },
  messEnabled: false,
  diningKey: null,
  selectedDate: todayKey(),
  dataVersion: 0,
  draft: null,

  hydrate: async () => {
    const [profile, themePref, modelId, useFallback, apiKey, engine, messEnabled, diningKey] = await Promise.all([
      db.getProfile(),
      db.getSetting('theme'),
      db.getSetting('model'),
      db.getSetting('fallback'),
      getApiKey().catch(() => null),
      db.getSetting('engine'),
      db.getSetting('mess'),
      getDiningKey().catch(() => null),
    ]);
    const modelReady = isModelReady();
    set({
      hydrated: true,
      profile,
      themePref: (themePref as ThemePref) ?? 'system',
      modelId: !modelId || RETIRED_MODELS.has(modelId) ? DEFAULT_MODEL : modelId,
      useFallback: useFallback !== 'false',
      apiKey,
      engine: engine === 'local' && modelReady ? 'local' : 'gemini',
      localModel: modelReady ? { state: 'ready' } : { state: 'none' },
      messEnabled: messEnabled === 'true',
      diningKey,
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
  setEngine: async (e) => {
    set({ engine: e });
    await db.setSetting('engine', e);
  },
  setMessEnabled: async (v) => {
    set({ messEnabled: v });
    await db.setSetting('mess', String(v));
  },
  setDiningKey: async (k) => {
    await setDiningKey(k);
    set({ diningKey: k.trim() || null });
  },
  downloadLocalModel: async () => {
    if (get().localModel.state === 'downloading') return;
    set({ localModel: { state: 'downloading', progress: 0 } });
    let last = 0;
    try {
      await downloadModel((progress) => {
        // Progress fires very often; only re-render on whole-percent changes.
        if (progress - last >= 0.01 || progress >= 1) {
          last = progress;
          set({ localModel: { state: 'downloading', progress } });
        }
      });
      set({ localModel: { state: 'ready' } });
    } catch (e) {
      set({ localModel: { state: 'error', message: e instanceof Error ? e.message : String(e) } });
    }
  },
  cancelLocalDownload: () => cancelDownload(),
  deleteLocalModel: async () => {
    await releaseLocalModel();
    deleteModel();
    set({ localModel: { state: 'none' } });
    if (get().engine === 'local') await get().setEngine('gemini');
  },
  setSelectedDate: (d) => set({ selectedDate: d }),
  bumpData: () => set({ dataVersion: get().dataVersion + 1 }),
  setDraft: (d) => set({ draft: d }),
  updateDraft: (patch) => {
    const d = get().draft;
    if (d) set({ draft: { ...d, ...patch } });
  },
}));
