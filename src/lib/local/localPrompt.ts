import type { ParsedItem } from './foodDb';

/**
 * The on-device model only names foods and amounts; calories come from the food table.
 * Small models are decent at "what is on the plate" and poor at nutrition numbers.
 */

export const LOCAL_SYSTEM_PROMPT = `You identify foods for a calorie tracker. Most meals are Indian home food.
List every distinct food or drink separately (e.g. roti, dal, rice, sabzi, curd, chai). Do not merge items.
Use common simple names like "roti", "dal tadka", "paneer butter masala", "masala omelette", "steamed rice".
For each item give quantity and unit. Prefer these units: piece, katori, bowl, plate, cup, glass, tbsp, tsp, slice, g, ml.
Write "small" or "large" in the unit if the user says so (e.g. "small katori").
grams_estimate is your rough guess of the TOTAL weight of that item in grams.
If the user's note corrects or adds something, trust the note.
If there is no food, return an empty items list.`;

export const LOCAL_SCHEMA = {
  type: 'object',
  properties: {
    dish_summary: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          quantity: { type: 'number' },
          unit: { type: 'string' },
          grams_estimate: { type: 'number' },
        },
        required: ['name', 'quantity', 'unit', 'grams_estimate'],
      },
    },
  },
  required: ['dish_summary', 'items'],
};

export function localUserText(opts: { hasPhoto: boolean; description?: string; note?: string }): string {
  const what = opts.hasPhoto
    ? 'List the foods in this photo with portions.'
    : `List the foods in this meal description with portions: "${opts.description ?? ''}"`;
  return `${what}${opts.note ? `\nUser note: "${opts.note}"` : ''}\nReply as JSON with dish_summary (under 6 words) and items.`;
}

export function parseLocalReply(text: string): { dishSummary: string; items: ParsedItem[] } {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('The on-device model gave no answer. Try again or describe the meal in words.');
  let raw: any;
  try {
    raw = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new Error('The on-device model answer was cut off. Try again.');
  }
  const num = (v: unknown, d: number) => {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) && n > 0 ? n : d;
  };
  const items: ParsedItem[] = (Array.isArray(raw?.items) ? raw.items : [])
    .filter((i: any) => typeof i?.name === 'string' && i.name.trim())
    .map((i: any) => ({
      name: i.name.trim(),
      quantity: num(i.quantity, 1),
      unit: typeof i.unit === 'string' && i.unit.trim() ? i.unit.trim() : 'serving',
      grams_estimate: num(i.grams_estimate, 0) || undefined,
    }));
  return { dishSummary: typeof raw?.dish_summary === 'string' ? raw.dish_summary.trim() : '', items };
}
