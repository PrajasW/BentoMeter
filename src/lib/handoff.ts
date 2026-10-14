import { AnalysisError, describeContext, parseAnalysis, SYSTEM_PROMPT, type AnalyzedMeal, type DayContext } from './prompt';

/**
 * "Ask a chat app" fallback: when the Gemini API is rate-limited, the user shares
 * the photo + this prompt with the Gemini/ChatGPT app and pastes the JSON reply back.
 */

export const HANDOFF_MODEL_LABEL = 'chat app';

/** First line of every prompt; also used to tell our own prompt apart from a pasted reply. */
const PROMPT_MARKER = 'BENTOMETER v1';

const EXAMPLE_REPLY = `{
  "dish_summary": "Dal rice with roti",
  "items": [
    { "name": "Roti", "portion": "2 medium rotis (~80 g)", "quantity": 2, "unit": "piece", "kcal": 220, "protein_g": 7, "carbs_g": 40, "fat_g": 4, "confidence": 0.8 }
  ],
  "recommendation": {
    "next_meal": "snack",
    "suggested_time": "17:00",
    "kcal_budget": 200,
    "ideas": [
      { "name": "Roasted chana", "kcal": 150, "why": "Protein and fibre" },
      { "name": "Fruit bowl", "kcal": 120, "why": "Light and fresh" }
    ],
    "tip": "Nice balanced lunch! 🍱"
  }
}`;

export function buildHandoffPrompt(ctx: DayContext, opts: { hasPhoto: boolean; description?: string }): string {
  const what = opts.hasPhoto
    ? 'Analyze the meal in the attached photo.'
    : `Analyze this meal described in words: "${opts.description ?? ''}"`;
  return `${PROMPT_MARKER} — meal analysis request

${SYSTEM_PROMPT}

${what}

${describeContext(ctx)}

Output format (important):
- Reply with ONLY one \`\`\`json code block, no other text.
- Use exactly these keys. kcal and macros are for the WHOLE quantity of each item.
- next_meal is one of: breakfast, lunch, snack, dinner, latenight. suggested_time is 24h HH:MM.
- Give 2–3 ideas.

Example of the shape (values are only an illustration):
\`\`\`json
${EXAMPLE_REPLY}
\`\`\``;
}

/** First balanced {...} block in the text, ignoring braces inside strings. */
function firstJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
    } else if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return text.slice(start, i + 1);
  }
  return null;
}

/** Quick check used to prefill the paste box from the clipboard. Our own prompt contains an example reply, so exclude it. */
export function looksLikeHandoffReply(text: string): boolean {
  return !text.includes(PROMPT_MARKER) && /"dish_summary"\s*:/.test(text) && /"items"\s*:/.test(text);
}

export function parseHandoffReply(text: string): Omit<AnalyzedMeal, 'modelUsed'> {
  const cleaned = text
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\u00A0/g, ' ');
  // Prefer the content of a ```json fence when there is one.
  const fenced = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const block = firstJsonObject(fenced ?? cleaned) ?? firstJsonObject(cleaned);
  if (!block) throw new AnalysisError("Couldn't find the meal JSON — copy the whole reply and try again.", 'parse');
  let raw: unknown;
  try {
    raw = JSON.parse(block.replace(/,\s*([}\]])/g, '$1'));
  } catch {
    throw new AnalysisError('The reply looks cut off or broken. Copy the whole answer and try again.', 'parse');
  }
  const parsed = parseAnalysis(raw);
  if (parsed.items.length === 0 && !parsed.dishSummary) {
    throw new AnalysisError('The reply had no food items in it.', 'parse');
  }
  return parsed;
}
