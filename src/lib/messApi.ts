import { deleteSettingsBefore, getSetting, setSetting } from './db';
import { addDays, todayKey } from './dates';
import {
  extractDayMenus,
  extractWeekMenus,
  parseRegistration,
  type DayMenus,
  type MessMeal,
  type Registration,
} from './mess';

/**
 * dining.iiit.ac.in API. Menus are public; registrations and bought extras need the
 * dining key (sent as a raw `Authorization` header, which is how the portal's API keys work).
 */
const BASE = 'https://dining.iiit.ac.in/api';
const TIMEOUT_MS = 8000;
const MENU_FRESH_MS = 12 * 60 * 60 * 1000;
const REG_FRESH_MS = 10 * 60 * 1000;
const KEEP_DAYS = 14;

export class DiningKeyError extends Error {}

async function getJson(path: string, key?: string | null): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: key ? { Authorization: key } : undefined,
      signal: controller.signal,
    });
    if (res.status === 401 || res.status === 403) throw new DiningKeyError('Dining key was rejected');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

interface Cached<T> {
  fetchedAt: number;
  value: T;
}

async function readCache<T>(key: string): Promise<Cached<T> | null> {
  try {
    const raw = await getSetting(key);
    return raw ? (JSON.parse(raw) as Cached<T>) : null;
  } catch {
    return null;
  }
}

async function writeCache<T>(key: string, value: T) {
  try {
    await setSetting(key, JSON.stringify({ fetchedAt: Date.now(), value }));
  } catch {
    // Caching is best-effort.
  }
}

export interface MenuResult {
  menus: DayMenus;
  /** True when the network failed and an older saved copy is being used. */
  fromCache: boolean;
  /** When this menu was downloaded (ms since epoch). */
  savedAt: number;
}

/**
 * That day's menus for our four messes. One request returns the whole week, so every
 * day of that week is saved at once; `force` skips the saved copy (the ↻ Refresh button).
 * Returns null if nothing could be loaded.
 */
export async function fetchMenusForDate(date: string, opts: { force?: boolean } = {}): Promise<MenuResult | null> {
  const cacheKey = `mess:menu:${date}`;
  const cached = await readCache<DayMenus>(cacheKey);
  const isPast = date < todayKey();
  if (!opts.force && cached && (isPast || Date.now() - cached.fetchedAt < MENU_FRESH_MS)) {
    return { menus: cached.value, fromCache: false, savedAt: cached.fetchedAt };
  }
  try {
    const week = extractWeekMenus(await getJson(`/mess/menus?on=${date}`), date);
    for (const [day, menus] of Object.entries(week)) await writeCache(`mess:menu:${day}`, menus);
    deleteSettingsBefore('mess:menu:', addDays(todayKey(), -KEEP_DAYS)).catch(() => {});
    return { menus: week[date] ?? extractDayMenus(null, date), fromCache: false, savedAt: Date.now() };
  } catch {
    return cached ? { menus: cached.value, fromCache: true, savedAt: cached.fetchedAt } : null;
  }
}

export type DayRegistration = Partial<Record<MessMeal, Registration>>;

/** Which mess the user is registered at for each meal of that day. Null without a key or when offline. */
export async function fetchRegistration(
  date: string,
  key: string | null,
  opts: { force?: boolean } = {},
): Promise<DayRegistration | null> {
  if (!key) return null;
  const cacheKey = `mess:reg:${date}`;
  const cached = await readCache<DayRegistration>(cacheKey);
  if (!opts.force && cached && Date.now() - cached.fetchedAt < REG_FRESH_MS) return cached.value;
  try {
    const reg = parseRegistration(await getJson(`/registration?date=${date}`, key));
    await writeCache(cacheKey, reg);
    deleteSettingsBefore('mess:reg:', addDays(todayKey(), -KEEP_DAYS)).catch(() => {});
    return reg;
  } catch (e) {
    if (e instanceof DiningKeyError) throw e;
    return cached?.value ?? null;
  }
}

/** Names of extras the user bought for that meal (e.g. an omelette). Empty on any failure. */
export async function fetchBoughtExtras(date: string, meal: MessMeal, key: string | null): Promise<string[]> {
  if (!key || meal === 'snacks') return [];
  try {
    const body = (await getJson(`/registrations/extras?meal=${meal}&date=${date}`, key)) as any;
    return (Array.isArray(body?.data) ? body.data : [])
      .filter((e: any) => !e?.cancelled_at)
      .map((e: any) => String(e?.extra_name ?? e?.name ?? '').trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

/** Settings "Test" button: check the key and describe today's registration. */
export async function testDiningKey(key: string): Promise<{ ok: boolean; message: string }> {
  try {
    const reg = parseRegistration(await getJson(`/registration?date=${todayKey()}`, key.trim()));
    const parts = (Object.entries(reg) as [MessMeal, Registration][])
      .filter(([, r]) => !r.cancelled)
      .map(([meal, r]) => `${meal}: ${r.apiMess ?? '—'}`);
    return { ok: true, message: parts.length ? `Key works! Today → ${parts.join(', ')}` : 'Key works! No meals registered today.' };
  } catch (e) {
    if (e instanceof DiningKeyError) return { ok: false, message: 'Key rejected by the dining portal' };
    return { ok: false, message: 'Could not reach dining.iiit.ac.in' };
  }
}
