import { SLOT_META, SLOTS } from './mealSlot';
import { round, toPerUnit } from './nutrition';
import { newId } from './dates';
import type { FoodItem, Macros, Profile, Recommendation, Slot, Targets } from './types';

/** Prompt, schema and parsing shared by every analysis engine (Gemini API, chat-app handoff, on-device). */
export interface DayContext {
  now: Date;
  slot: Slot;
  eatenAt: Date;
  profile: Profile;
  targets: Targets;
  /** Meals already logged on that day, excluding the one being analyzed. */
  earlierMeals: { slot: Slot; time: string; summary: string; kcal: number }[];
  consumedSoFar: Macros;
  note?: string;
}

export interface AnalyzedMeal {
  dishSummary: string;
  items: FoodItem[];
  recommendation: Recommendation | null;
  modelUsed: string;
}

export class AnalysisError extends Error {
  constructor(
    message: string,
    readonly kind: 'auth' | 'quota' | 'network' | 'parse' | 'other',
  ) {
    super(message);
  }
}

// ---------- schemas ----------

export const recommendationSchema = {
  type: 'object',
  properties: {
    next_meal: { type: 'string', enum: SLOTS },
    suggested_time: { type: 'string', description: '24h HH:MM local time' },
    kcal_budget: { type: 'number', description: 'Calories suggested for the next meal' },
    ideas: {
      type: 'array',
      minItems: 2,
      maxItems: 3,
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          kcal: { type: 'number' },
          why: { type: 'string', description: 'One short reason, under 12 words' },
        },
        required: ['name', 'kcal', 'why'],
      },
    },
    tip: { type: 'string', description: 'One friendly sentence, may contain one cute emoji' },
  },
  required: ['next_meal', 'suggested_time', 'kcal_budget', 'ideas', 'tip'],
};

export const analysisSchema = {
  type: 'object',
  properties: {
    dish_summary: { type: 'string', description: 'Short title for the meal, under 8 words' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          portion: { type: 'string', description: 'Human-friendly portion, e.g. "1 medium bowl (~250 g)"' },
          quantity: { type: 'number' },
          unit: { type: 'string', description: 'e.g. piece, bowl, cup, slice, g, ml' },
          kcal: { type: 'number', description: 'Calories for the WHOLE quantity' },
          protein_g: { type: 'number' },
          carbs_g: { type: 'number' },
          fat_g: { type: 'number' },
          confidence: { type: 'number', description: '0–1 confidence in identification and portion' },
        },
        required: ['name', 'portion', 'quantity', 'unit', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'confidence'],
      },
    },
    recommendation: recommendationSchema,
  },
  required: ['dish_summary', 'items', 'recommendation'],
};

// ---------- prompts ----------

export const SYSTEM_PROMPT = `You are BentoMeter, a careful nutrition estimator and a warm, encouraging meal coach.

Food analysis rules:
- List every distinct food or drink item separately (e.g. rice, curry, side salad, drink). Do not merge separate items.
- Estimate portions from visual cues: standard plates are ~26 cm, bowls ~250–400 ml, use utensils and hands for scale.
- Choose a natural quantity + unit per item (2 piece roti, 1 bowl dal, 150 g rice, 1 cup chai). kcal and macros are for the WHOLE quantity.
- Include likely hidden calories (cooking oil, ghee, butter, dressings, sugar in drinks) inside the item they belong to.
- Use realistic home/restaurant values for the cuisine you see. Be accurate rather than optimistic.
- If the user's note corrects or adds information, trust the note.
- If the image contains no food, return an empty items array and say so in dish_summary.

Recommendation rules:
- Base it on the whole day: meals already eaten + this meal, against the daily target and macro targets, and the current time.
- Pick the next sensible meal slot and a realistic time. kcal_budget should fit what is left of the day.
- Give 2–3 concrete, simple ideas in a similar cuisine style to what the user eats. Prioritise any macro that is falling behind (often protein).
- If the user is already over target, suggest something light and kind, never shaming.
- The tip is one short, cheerful sentence with at most one cute emoji.`;

export function describeContext(ctx: DayContext): string {
  const p = ctx.profile;
  const t = ctx.targets;
  const c = ctx.consumedSoFar;
  const fmt = (d: Date) => d.toTimeString().slice(0, 5);
  const earlier = ctx.earlierMeals.length
    ? ctx.earlierMeals
        .map((m) => `- ${m.time} ${SLOT_META[m.slot].label}: ${m.summary} (${Math.round(m.kcal)} kcal)`)
        .join('\n')
    : '- nothing logged yet';
  return `Context:
- Current local time: ${fmt(ctx.now)}
- This meal: ${SLOT_META[ctx.slot].label}, eaten at ${fmt(ctx.eatenAt)}
- User: ${p.age} y, ${p.sex}, ${p.heightCm} cm, ${p.weightKg} kg, activity ${p.activity}, goal ${p.goal}
- Daily targets: ${t.kcal} kcal, protein ${t.proteinG} g, carbs ${t.carbsG} g, fat ${t.fatG} g
- Eaten earlier that day (before this meal): ${Math.round(c.kcal)} kcal, P ${Math.round(c.proteinG)} g, C ${Math.round(c.carbsG)} g, F ${Math.round(c.fatG)} g
${earlier}${ctx.note ? `\n- User note about this meal: "${ctx.note}"` : ''}`;
}

// ---------- parsing ----------

const num = (v: unknown, fallback = 0) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};
const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v.trim() : fallback);

export function parseRecommendation(raw: any): Recommendation | null {
  if (!raw || typeof raw !== 'object') return null;
  const nextMeal = SLOTS.includes(raw.next_meal) ? (raw.next_meal as Slot) : 'snack';
  return {
    nextMeal,
    suggestedTime: str(raw.suggested_time),
    kcalBudget: Math.round(num(raw.kcal_budget)),
    ideas: (Array.isArray(raw.ideas) ? raw.ideas : []).slice(0, 3).map((i: any) => ({
      name: str(i?.name, 'Idea'),
      kcal: Math.round(num(i?.kcal)),
      why: str(i?.why),
    })),
    tip: str(raw.tip),
  };
}

export function parseAnalysis(raw: any): Omit<AnalyzedMeal, 'modelUsed'> {
  if (!raw || typeof raw !== 'object') throw new AnalysisError('The AI returned an empty analysis.', 'parse');
  const items: FoodItem[] = (Array.isArray(raw.items) ? raw.items : []).map((i: any) => {
    const per = toPerUnit(round(num(i?.quantity, 1), 2), {
      kcal: num(i?.kcal),
      proteinG: num(i?.protein_g),
      carbsG: num(i?.carbs_g),
      fatG: num(i?.fat_g),
    });
    return {
      id: newId(),
      name: str(i?.name, 'Food'),
      portion: str(i?.portion),
      unit: str(i?.unit, 'serving') || 'serving',
      confidence: i?.confidence == null ? null : Math.min(1, num(i.confidence)),
      ...per,
    };
  });
  return {
    dishSummary: str(raw.dish_summary, 'Meal'),
    items,
    recommendation: parseRecommendation(raw.recommendation),
  };
}
