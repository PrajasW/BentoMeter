import type { Slot } from './types';

/**
 * IIIT Hyderabad mess menus (dining.iiit.ac.in). Pure helpers only; network and
 * caching live in messApi.ts so this file stays easy to test.
 */

export type MessId = 'kadamba' | 'yuktahar' | 'bakul' | 'palash';
export type MessMeal = 'breakfast' | 'lunch' | 'snacks' | 'dinner';

export interface MessInfo {
  id: MessId;
  label: string;
  /** Menu id on the dining API. Kadamba and Bakul use the non-veg menu (veg menu + non-veg items). */
  menuId: string;
  /** Paid extras sold at the counter for a given meal, used as a hint for the AI. */
  extras: Partial<Record<MessMeal, string[]>>;
}

/** In the order the user wants them in the dropdown. */
export const MESSES: MessInfo[] = [
  { id: 'kadamba', label: 'Kadamba', menuId: 'kadamba-nonveg', extras: { dinner: ['2-egg omelette'] } },
  { id: 'yuktahar', label: 'Yuktāhār', menuId: 'yuktahar', extras: {} },
  { id: 'bakul', label: 'Bakul', menuId: 'bakul-nonveg', extras: {} },
  { id: 'palash', label: 'Palāsh', menuId: 'palash', extras: {} },
];

export const DEFAULT_MESS: MessId = 'kadamba';

export const messInfo = (id: MessId): MessInfo => MESSES.find((m) => m.id === id) ?? MESSES[0];

export interface MenuItem {
  item: string;
  category: string;
}

/** One day's menus for our four messes: mess → meal → items (empty items already dropped). */
export type DayMenus = Partial<Record<MessId, Partial<Record<MessMeal, MenuItem[]>>>>;

export interface MessContext {
  messLabel: string;
  meal: MessMeal;
  items: MenuItem[];
  extras: string[];
  boughtExtras: string[];
}

const SLOT_TO_MEAL: Record<Slot, MessMeal | null> = {
  breakfast: 'breakfast',
  lunch: 'lunch',
  // The mess snacks menu isn't used: snacks are logged without mess context.
  snack: null,
  dinner: 'dinner',
  latenight: null,
};

/** Mess meal for an app slot: breakfast, lunch and dinner only. */
export const mealForSlot = (slot: Slot): MessMeal | null => SLOT_TO_MEAL[slot];

/** Map any dining-API mess id (kadamba-veg, kadamba-nonveg-mild, yuktahar-jain…) to our four messes. */
export function messGroupFor(apiMessId: string | null | undefined): MessId | null {
  if (!apiMessId) return null;
  const id = apiMessId.toLowerCase();
  return MESSES.find((m) => id === m.id || id.startsWith(`${m.id}-`))?.id ?? null;
}

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/** Weekday name for a YYYY-MM-DD key, as used in the API's `days` object. */
export function weekdayFor(dayKey: string): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  return WEEKDAYS[new Date(y, m - 1, d).getDay()];
}

const MEALS: MessMeal[] = ['breakfast', 'lunch', 'snacks', 'dinner'];

/** Pick that day's menus for our four messes out of a `/api/mess/menus` response. */
export function extractDayMenus(response: unknown, dayKey: string): DayMenus {
  const data = (response as any)?.data;
  if (!Array.isArray(data)) return {};
  const weekday = weekdayFor(dayKey);
  const out: DayMenus = {};
  for (const mess of MESSES) {
    const entry = data.find((d: any) => d?.mess === mess.menuId);
    const day = entry?.days?.[weekday];
    if (!day) continue;
    const meals: Partial<Record<MessMeal, MenuItem[]>> = {};
    for (const meal of MEALS) {
      const items = (Array.isArray(day[meal]) ? day[meal] : [])
        .map((i: any) => ({ item: String(i?.item ?? '').trim(), category: String(i?.category ?? '').trim() }))
        .filter((i: MenuItem) => i.item);
      if (items.length) meals[meal] = items;
    }
    if (Object.keys(meals).length) out[mess.id] = meals;
  }
  return out;
}

/**
 * The menus response covers a whole week, so one request can fill the cache for
 * every day of the Sunday–Saturday week containing `dayKey`.
 */
export function extractWeekMenus(response: unknown, dayKey: string): Record<string, DayMenus> {
  const [y, m, d] = dayKey.split('-').map(Number);
  const sunday = new Date(y, m - 1, d);
  sunday.setDate(sunday.getDate() - sunday.getDay());
  const out: Record<string, DayMenus> = {};
  for (let i = 0; i < 7; i++) {
    const day = new Date(sunday);
    day.setDate(sunday.getDate() + i);
    const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    out[key] = extractDayMenus(response, key);
  }
  return out;
}

export interface Registration {
  mess: MessId | null;
  /** Raw dining-API mess id, e.g. "kadamba-nonveg". */
  apiMess: string | null;
  cancelled: boolean;
  availedAt: string | null;
}

/** Parse `/api/registration?date=` into per-meal registrations. */
export function parseRegistration(response: unknown): Partial<Record<MessMeal, Registration>> {
  const data = (response as any)?.data;
  if (!data || typeof data !== 'object') return {};
  const out: Partial<Record<MessMeal, Registration>> = {};
  for (const meal of MEALS) {
    const r = data[meal];
    if (!r || typeof r !== 'object') continue;
    const apiMess = typeof r.meal_mess === 'string' ? r.meal_mess : null;
    out[meal] = {
      mess: messGroupFor(apiMess),
      apiMess,
      cancelled: !!r.cancelled_at,
      availedAt: typeof r.availed_at === 'string' ? r.availed_at : null,
    };
  }
  return out;
}

export function buildMessContext(args: {
  messId: MessId;
  meal: MessMeal;
  menus: DayMenus;
  boughtExtras?: string[];
}): MessContext | null {
  const items = args.menus[args.messId]?.[args.meal];
  if (!items?.length) return null;
  const info = messInfo(args.messId);
  return {
    messLabel: info.label,
    meal: args.meal,
    items,
    extras: info.extras[args.meal] ?? [],
    boughtExtras: args.boughtExtras ?? [],
  };
}

const COMPACT_LIMIT = 450;

/**
 * Menu text for prompts. "full" keeps categories (Gemini / chat apps);
 * "compact" is dish names only, capped for the small on-device model.
 */
export function formatMessMenu(ctx: MessContext, mode: 'full' | 'compact'): string {
  if (mode === 'full') {
    return ctx.items.map((i) => (i.category ? `${i.category}: ${i.item}` : i.item)).join('; ');
  }
  let out = '';
  for (const { item } of ctx.items) {
    const next = out ? `${out}, ${item}` : item;
    if (next.length > COMPACT_LIMIT) return `${out}, …`;
    out = next;
  }
  return out;
}

/** Context lines appended to the shared prompt (describeContext). */
export function messContextLines(ctx: MessContext): string {
  const lines = [
    `- Eating at the ${ctx.messLabel} mess (IIIT Hyderabad hostel mess). Its ${ctx.meal} menu today; the plate is almost certainly made of these: ${formatMessMenu(ctx, 'full')}`,
  ];
  if (ctx.extras.length) lines.push(`- Paid extras sold at this mess: ${ctx.extras.join(', ')}`);
  if (ctx.boughtExtras.length) lines.push(`- The user bought these extras for this meal: ${ctx.boughtExtras.join(', ')}`);
  return lines.join('\n');
}
