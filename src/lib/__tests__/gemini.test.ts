/// <reference types="jest" />
import { DEFAULT_MODEL, FALLBACK_MODELS, MODEL_CHOICES } from '../gemini';

describe('Gemini model list', () => {
  it('offers just Flash and Flash-Lite (latest aliases)', () => {
    expect(MODEL_CHOICES.map((m) => m.id)).toEqual(['gemini-flash-latest', 'gemini-flash-lite-latest']);
  });

  it('defaults to a model in the picker', () => {
    expect(MODEL_CHOICES.some((m) => m.id === DEFAULT_MODEL)).toBe(true);
  });

  it('falls back from Flash to the cheaper Flash-Lite', () => {
    expect(FALLBACK_MODELS).toEqual(['gemini-flash-latest', 'gemini-flash-lite-latest']);
  });
});
