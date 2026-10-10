import { SLOT_META, SLOTS } from './mealSlot';
import { round, toPerUnit } from './nutrition';
import { newId } from './dates';
import type { FoodItem, Macros, Profile, Recommendation, Slot, Targets } from './types';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export const DEFAULT_MODEL = 'gemini-pro-latest';

/** Tried in order after the preferred model when it is out of quota or overloaded. */
export const FALLBACK_MODELS = ['gemini-3.1-pro-preview', 'gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-flash-latest'];

export const MODEL_CHOICES = [
  { id: 'gemini-pro-latest', label: 'Pro (latest)' },
  { id: 'gemini-3.1-pro-preview', label: '3.1 Pro preview' },
  { id: 'gemini-3.8-flash', label: '3.8 Flash' },
  { id: 'gemini-3.5-flash', label: '3.5 Flash' },
];

const REQUEST_TIMEOUT_MS = 90_000;

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

export class GeminiError extends Error {
  constructor(
    message: string,
    readonly kind: 'auth' | 'quota' | 'network' | 'parse' | 'other',
  ) {
    super(message);
  }
}

// ---------- schemas ----------

const recommendationSchema = {
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

const analysisSchema = {
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

const SYSTEM_PROMPT = `You are BentoMeter, a careful nutrition estimator and a warm, encouraging meal coach.

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

function describeContext(ctx: DayContext): string {
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

// ---------- transport ----------

interface GenerateArgs {
  apiKey: string;
  model: string;
  parts: object[];
  schema: object;
}

async function generateOnce({ apiKey, model, parts, schema }: GenerateArgs): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseJsonSchema: schema,
        },
      }),
      signal: controller.signal,
    });
  } catch (e) {
    throw new GeminiError(
      controller.signal.aborted ? 'Gemini took too long to answer.' : 'Could not reach Gemini. Check your internet.',
      'network',
    );
  } finally {
    clearTimeout(timer);
  }

  const body: any = await res.json().catch(() => null);
  if (!res.ok) {
    const msg: string = body?.error?.message ?? `HTTP ${res.status}`;
    if (res.status === 400 && /api key/i.test(msg)) throw new GeminiError('Your Gemini API key was rejected.', 'auth');
    if (res.status === 401 || res.status === 403) throw new GeminiError('Your Gemini API key was rejected.', 'auth');
    if (res.status === 429) throw new GeminiError('Gemini quota exceeded for this model.', 'quota');
    // 404 (model retired for this key), 5xx (overloaded) are worth trying another model on.
    throw new GeminiError(msg.split('\n')[0], res.status === 404 || res.status >= 500 ? 'quota' : 'other');
  }

  const outParts: any[] = body?.candidates?.[0]?.content?.parts ?? [];
  const text = outParts
    .filter((p) => typeof p.text === 'string' && !p.thought)
    .map((p) => p.text)
    .join('');
  if (!text) {
    const reason = body?.candidates?.[0]?.finishReason ?? body?.promptFeedback?.blockReason;
    throw new GeminiError(`Gemini returned no answer${reason ? ` (${reason})` : ''}.`, 'parse');
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new GeminiError('Gemini returned something that was not valid JSON.', 'parse');
  }
}

/**
 * Models that recently failed with quota/overload errors are skipped for a while,
 * so a key without Pro quota doesn't pay for the failed Pro attempts on every meal.
 */
const cooldownUntil = new Map<string, number>();
const QUOTA_COOLDOWN_MS = 60 * 60 * 1000;
const BUSY_COOLDOWN_MS = 5 * 60 * 1000;

/** Try the preferred model, then fall back through FALLBACK_MODELS on quota/overload/network errors. */
async function generate(
  args: Omit<GenerateArgs, 'model'> & { model: string; useFallback: boolean },
): Promise<{ json: unknown; modelUsed: string }> {
  const all = args.useFallback ? [...new Set([args.model, ...FALLBACK_MODELS])] : [args.model];
  const now = Date.now();
  const ready = all.filter((m) => (cooldownUntil.get(m) ?? 0) <= now);
  const chain = ready.length ? ready : all;
  let lastError: GeminiError | null = null;
  for (const model of chain) {
    try {
      const json = await generateOnce({ ...args, model });
      cooldownUntil.delete(model);
      return { json, modelUsed: model };
    } catch (e) {
      const err = e instanceof GeminiError ? e : new GeminiError(String(e), 'other');
      if (err.kind === 'auth') throw err;
      if (err.kind === 'quota') {
        const isQuota = /quota/i.test(err.message);
        cooldownUntil.set(model, Date.now() + (isQuota ? QUOTA_COOLDOWN_MS : BUSY_COOLDOWN_MS));
      } else if (err.kind === 'network') {
        cooldownUntil.set(model, Date.now() + BUSY_COOLDOWN_MS);
      }
      lastError = err;
    }
  }
  throw lastError ?? new GeminiError('Gemini request failed.', 'other');
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
  if (!raw || typeof raw !== 'object') throw new GeminiError('Gemini returned an empty analysis.', 'parse');
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

// ---------- public API ----------

interface CallOptions {
  apiKey: string;
  model: string;
  useFallback: boolean;
}

/** One call: identify foods + portions + calories/macros AND recommend the next meal. */
export async function analyzeMeal(
  opts: CallOptions & { imageBase64?: string; description?: string; context: DayContext },
): Promise<AnalyzedMeal> {
  const parts: object[] = [];
  if (opts.imageBase64) parts.push({ inlineData: { mimeType: 'image/jpeg', data: opts.imageBase64 } });
  const what = opts.imageBase64
    ? 'Analyze the meal in this photo.'
    : `Analyze this meal described in words: "${opts.description ?? ''}"`;
  parts.push({ text: `${what}\n\n${describeContext(opts.context)}` });

  const { json, modelUsed } = await generate({ ...opts, parts, schema: analysisSchema });
  return { ...parseAnalysis(json), modelUsed };
}

/** Cheap text-only call to refresh the recommendation after the user edited a meal. */
export async function refreshRecommendation(
  opts: CallOptions & { context: DayContext; thisMeal: { summary: string; totals: Macros } },
): Promise<Recommendation | null> {
  const m = opts.thisMeal;
  const text = `The user just logged this meal (already corrected by them): ${m.summary} — ${Math.round(m.totals.kcal)} kcal, P ${Math.round(m.totals.proteinG)} g, C ${Math.round(m.totals.carbsG)} g, F ${Math.round(m.totals.fatG)} g.
Recommend what to eat next.

${describeContext(opts.context)}`;
  const { json } = await generate({ ...opts, parts: [{ text }], schema: recommendationSchema });
  return parseRecommendation(json);
}

/** Quick connectivity/key check used in onboarding and settings. */
export async function testApiKey(apiKey: string): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(`${API_BASE}/models?pageSize=200`, { headers: { 'x-goog-api-key': apiKey } });
    const body: any = await res.json().catch(() => null);
    if (!res.ok) {
      const detail = String(body?.error?.message ?? `HTTP ${res.status}`).split('\n')[0];
      return { ok: false, message: `Key rejected — ${detail}` };
    }
    const names: string[] = (body.models ?? []).map((m: any) => String(m.name));
    const hasPro = names.some((n) => n.includes('pro-latest') || n.includes('pro-preview'));
    return { ok: true, message: hasPro ? 'Key works! Pro models available ✨' : 'Key works!' };
  } catch {
    return { ok: false, message: 'Could not reach Gemini' };
  }
}
