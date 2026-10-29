import {
  AnalysisError,
  analysisSchema,
  describeContext,
  parseAnalysis,
  parseRecommendation,
  recommendationSchema,
  SYSTEM_PROMPT,
  type AnalyzedMeal,
  type DayContext,
} from './prompt';
import type { Macros, Recommendation } from './types';

export type { AnalyzedMeal, DayContext } from './prompt';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

// `-latest` aliases always point at Google's newest release, so this list doesn't go stale.
export const DEFAULT_MODEL = 'gemini-flash-latest';

/** Tried in order after the preferred model when it is out of quota or overloaded. Flash-Lite is the cheapest. */
export const FALLBACK_MODELS = ['gemini-flash-latest', 'gemini-flash-lite-latest'];

export const MODEL_CHOICES = [
  { id: 'gemini-flash-latest', label: 'Flash (latest)' },
  { id: 'gemini-flash-lite-latest', label: 'Flash-Lite (latest) · cheapest' },
];

const REQUEST_TIMEOUT_MS = 90_000;

export class GeminiError extends AnalysisError {}

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
