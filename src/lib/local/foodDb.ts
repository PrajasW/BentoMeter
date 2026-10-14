import { newId } from '../dates';
import { round } from '../nutrition';
import type { FoodItem } from '../types';

/**
 * Bundled Indian nutrition table (scripts/build_foods.py → assets/data/foods.json):
 * curated staples + INDB recipes. Values are per 100 g; `s` lists household servings in grams.
 */
export interface Food {
  id: string;
  /** Display name. */
  n: string;
  /** Lowercase aliases (local names, spellings). */
  a: string[];
  k: number;
  p: number;
  c: number;
  f: number;
  s: [unit: string, grams: number][];
}

/** What the language model extracts — names and amounts only, never calories. */
export interface ParsedItem {
  name: string;
  quantity: number;
  unit: string;
  /** Model's rough total weight for the item, used when the unit is unknown. */
  grams_estimate?: number;
}

export interface FoodMatch {
  food: Food;
  score: number;
}

/** Below this score an item is kept but left at 0 kcal for the user to fill in. */
export const MIN_MATCH_SCORE = 0.5;

// ---------- normalisation ----------

const singular = (w: string) =>
  w.length > 3 && w.endsWith('es') && /(ch|sh|ss|x|o)es$/.test(w)
    ? w.slice(0, -2)
    : w.length > 3 && w.endsWith('s') && !w.endsWith('ss')
      ? w.slice(0, -1)
      : w;

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(singular)
    .join(' ');
}

function trigrams(s: string): Set<string> {
  const padded = `  ${s} `;
  const out = new Set<string>();
  for (let i = 0; i < padded.length - 2; i++) out.add(padded.slice(i, i + 3));
  return out;
}

function dice(a: Set<string>, b: Set<string>): number {
  let shared = 0;
  for (const g of a) if (b.has(g)) shared++;
  return (2 * shared) / (a.size + b.size || 1);
}

// ---------- index ----------

interface Entry {
  food: Food;
  /** Normalised name + aliases with their trigram sets. */
  keys: { text: string; tokens: string[]; grams: Set<string> }[];
  curated: boolean;
}

let index: Entry[] | null = null;

/** One-word aliases too generic to identify a dish on their own (from INDB names like "Cabbage rolls (curry)"). */
const GENERIC_WORDS = new Set(['curry', 'dry', 'gravy', 'sweet', 'plain', 'toasted', 'fried', 'boiled', 'veg', 'vegetable', 'masala', 'special']);

export function buildIndex(foods: Food[]): Entry[] {
  return foods.map((food) => {
    const texts = [...new Set([food.n, ...food.a].map(normalize))].filter((t) => t.length >= 2 && !GENERIC_WORDS.has(t));
    return {
      food,
      curated: food.id.startsWith('B'),
      keys: texts.map((text) => ({ text, tokens: text.split(' '), grams: trigrams(text) })),
    };
  });
}

function getIndex(): Entry[] {
  if (!index) index = buildIndex(require('../../../assets/data/foods.json') as Food[]);
  return index;
}

/** For tests: swap in a small table. */
export function setFoodsForTesting(foods: Food[] | null) {
  index = foods ? buildIndex(foods) : null;
}

// ---------- search ----------

function scoreEntry(query: string, qTokens: string[], qGrams: Set<string>, e: Entry): number {
  let best = 0;
  for (const k of e.keys) {
    let s: number;
    if (k.text === query) s = 1;
    else {
      s = dice(qGrams, k.grams);
      if (k.tokens.every((t) => qTokens.includes(t))) {
        // "masala omelette" contains the alias "omelette": good, better the more of the query it covers.
        s = Math.max(s, 0.55 + 0.4 * (k.tokens.length / qTokens.length));
      } else if (qTokens.every((t) => k.tokens.includes(t))) {
        // "fried rice" inside "chinese fried rice".
        s = Math.max(s, 0.6 + 0.35 * (qTokens.length / k.tokens.length));
      }
    }
    if (s > best) best = s;
  }
  // Prefer curated staples when INDB has a similar recipe name.
  return best + (e.curated ? 0.03 : 0);
}

export function findFood(name: string, limit = 3): FoodMatch[] {
  const query = normalize(name);
  if (!query) return [];
  const qTokens = query.split(' ');
  const qGrams = trigrams(query);
  return getIndex()
    .map((e) => ({ food: e.food, score: Math.min(1, scoreEntry(query, qTokens, qGrams, e)) }))
    .filter((m) => m.score > 0.2)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ---------- units ----------

const UNIT_ALIASES: Record<string, string> = {
  pc: 'piece', pcs: 'piece', piece: 'piece', nos: 'piece', no: 'piece', number: 'piece', whole: 'piece',
  katori: 'katori', katoris: 'katori', vati: 'katori', wati: 'katori',
  bowl: 'bowl', cup: 'cup', mug: 'cup', glass: 'glass', plate: 'plate', serving: 'serving', portion: 'serving',
  tablespoon: 'tbsp', tbsp: 'tbsp', tbs: 'tbsp', teaspoon: 'tsp', tsp: 'tsp', spoon: 'tbsp',
  slice: 'slice', handful: 'handful', scoop: 'scoop', can: 'can', packet: 'packet',
  g: 'g', gm: 'g', gram: 'g', grams: 'g', gms: 'g', ml: 'ml', millilitre: 'ml', milliliter: 'ml',
};

/** Typical Indian household measures, grams. */
const GENERIC_GRAMS: Record<string, number> = {
  katori: 150, bowl: 200, cup: 200, glass: 250, plate: 250, tbsp: 15, tsp: 5,
  slice: 30, handful: 30, scoop: 32, can: 330, packet: 70,
};

const VOLUME_UNITS = new Set(['katori', 'bowl', 'cup', 'glass', 'plate', 'tbsp', 'tsp', 'handful', 'scoop', 'can', 'packet']);

function parseUnit(unit: string): { base: string; factor: number } {
  const words = normalize(unit).split(' ').filter(Boolean);
  let factor = 1;
  const rest: string[] = [];
  for (const w of words) {
    if (w === 'small' || w === 'half') factor *= w === 'half' ? 0.5 : 0.7;
    else if (w === 'large' || w === 'big') factor *= 1.4;
    else if (w !== 'medium' && w !== 'of') rest.push(w);
  }
  const joined = rest.join(' ');
  const base = UNIT_ALIASES[joined] ?? UNIT_ALIASES[rest[rest.length - 1] ?? ''] ?? joined;
  return { base, factor };
}

/** Grams for ONE unit of the item, and how we got it. */
export function gramsPerUnit(food: Food | null, item: ParsedItem): { grams: number; source: 'weight' | 'serving' | 'generic' | 'estimate' } {
  const qty = item.quantity > 0 ? item.quantity : 1;
  const { base, factor } = parseUnit(item.unit || 'serving');
  if (base === 'g' || base === 'ml') return { grams: 1, source: 'weight' };

  const servings = food?.s ?? [];
  const own = servings.find(([u]) => normalize(u) === base || (base !== 'piece' && normalize(u).endsWith(base)));
  if (own) return { grams: own[1] * factor, source: 'serving' };

  // "2 rotis" often comes back as unit "roti" or "piece": use the food's countable serving.
  const countable = servings.find(([u]) => !VOLUME_UNITS.has(parseUnit(u).base));
  if ((base === 'piece' || base === 'serving' || (food && normalize(food.n).includes(base))) && countable) {
    return { grams: countable[1] * factor, source: 'serving' };
  }
  if (GENERIC_GRAMS[base]) return { grams: GENERIC_GRAMS[base] * factor, source: 'generic' };
  if (item.grams_estimate && item.grams_estimate > 0) return { grams: item.grams_estimate / qty, source: 'estimate' };
  if (servings[0]) return { grams: servings[0][1] * factor, source: 'serving' };
  return { grams: 100 * factor, source: 'generic' };
}

// ---------- to app items ----------

export function toFoodItem(item: ParsedItem, match: FoodMatch | null): FoodItem {
  const quantity = item.quantity > 0 ? round(item.quantity, 2) : 1;
  const unit = (item.unit || 'serving').trim();
  if (!match || match.score < MIN_MATCH_SCORE) {
    return {
      id: newId(),
      name: item.name,
      portion: `${quantity} ${unit} · not in food table, add calories`,
      quantity,
      unit,
      kcalPerUnit: 0,
      proteinPerUnit: 0,
      carbsPerUnit: 0,
      fatPerUnit: 0,
      confidence: 0,
    };
  }
  const { food } = match;
  const { grams } = gramsPerUnit(food, { ...item, quantity });
  const per = (v: number) => round((v * grams) / 100, 1);
  return {
    id: newId(),
    name: food.n,
    portion: `${quantity} ${unit} (~${Math.round(grams * quantity)} g)`,
    quantity,
    unit,
    kcalPerUnit: per(food.k),
    proteinPerUnit: per(food.p),
    carbsPerUnit: per(food.c),
    fatPerUnit: per(food.f),
    confidence: round(match.score, 2),
  };
}

export function itemsFromParsed(items: ParsedItem[]): FoodItem[] {
  return items.filter((i) => i.name?.trim()).map((i) => toFoodItem(i, findFood(i.name)[0] ?? null));
}
