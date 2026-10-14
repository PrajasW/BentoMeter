/// <reference types="jest" />
import { buildHandoffPrompt, looksLikeHandoffReply, parseHandoffReply } from '../handoff';
import type { DayContext } from '../prompt';

const reply = {
  dish_summary: 'Paneer thali',
  items: [
    { name: 'Roti', portion: '2 rotis', quantity: 2, unit: 'piece', kcal: 220, protein_g: 7, carbs_g: 40, fat_g: 4, confidence: 0.8 },
    { name: 'Paneer butter masala', portion: '1 katori', quantity: 1, unit: 'bowl', kcal: 300, protein_g: 12, carbs_g: 10, fat_g: 24, confidence: 0.7 },
  ],
  recommendation: {
    next_meal: 'snack',
    suggested_time: '17:00',
    kcal_budget: 200,
    ideas: [
      { name: 'Chana', kcal: 150, why: 'Protein' },
      { name: 'Fruit', kcal: 100, why: 'Light' },
    ],
    tip: 'Yum!',
  },
};
const json = JSON.stringify(reply, null, 2);

describe('parseHandoffReply', () => {
  it('parses a fenced reply wrapped in prose', () => {
    const out = parseHandoffReply(`Sure! Here you go:\n\`\`\`json\n${json}\n\`\`\`\nEnjoy 🍱`);
    expect(out.dishSummary).toBe('Paneer thali');
    expect(out.items).toHaveLength(2);
    expect(out.items[0].kcalPerUnit).toBe(110);
    expect(out.recommendation?.nextMeal).toBe('snack');
  });

  it('parses bare JSON', () => {
    expect(parseHandoffReply(json).items[1].name).toBe('Paneer butter masala');
  });

  it('tolerates trailing commas and smart quotes', () => {
    const messy = '{“dish_summary”: “Eggs”, "items": [{"name": "Egg", "quantity": 2, "unit": "piece", "kcal": 140,},],}';
    const out = parseHandoffReply(messy);
    expect(out.dishSummary).toBe('Eggs');
    expect(out.items[0].kcalPerUnit).toBe(70);
  });

  it('keeps braces inside strings intact', () => {
    const out = parseHandoffReply('{"dish_summary": "Rice {large}", "items": []}');
    expect(out.dishSummary).toBe('Rice {large}');
  });

  it('returns null recommendation when missing', () => {
    expect(parseHandoffReply('{"dish_summary": "Tea", "items": []}').recommendation).toBeNull();
  });

  it('throws a friendly error on junk', () => {
    expect(() => parseHandoffReply('I cannot see the image')).toThrow(/Couldn't find/);
    expect(() => parseHandoffReply('{"dish_summary": "x", "items": [')).toThrow();
  });
});

describe('looksLikeHandoffReply', () => {
  it('detects replies', () => {
    expect(looksLikeHandoffReply(json)).toBe(true);
    expect(looksLikeHandoffReply('hello')).toBe(false);
  });
});

describe('buildHandoffPrompt', () => {
  const ctx: DayContext = {
    now: new Date(2026, 9, 13, 13, 0),
    slot: 'lunch',
    eatenAt: new Date(2026, 9, 13, 12, 30),
    profile: { name: '', age: 25, sex: 'male', heightCm: 175, weightKg: 70, activity: 'moderate', goal: 'maintain', targetOverride: null },
    targets: { kcal: 2400, proteinG: 120, carbsG: 300, fatG: 70 },
    earlierMeals: [],
    consumedSoFar: { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  };
  it('mentions the photo or the description and the output format', () => {
    expect(buildHandoffPrompt(ctx, { hasPhoto: true })).toMatch(/attached photo/);
    const text = buildHandoffPrompt(ctx, { hasPhoto: false, description: '2 rotis' });
    expect(text).toMatch(/"2 rotis"/);
    expect(text).toMatch(/dish_summary/);
  });
});

describe('looksLikeHandoffReply vs our own prompt', () => {
  it('does not mistake the prompt (which contains an example reply) for a reply', () => {
    const ctx: DayContext = {
      now: new Date(2026, 9, 13, 13, 0),
      slot: 'lunch',
      eatenAt: new Date(2026, 9, 13, 12, 30),
      profile: { name: '', age: 25, sex: 'male', heightCm: 175, weightKg: 70, activity: 'moderate', goal: 'maintain', targetOverride: null },
      targets: { kcal: 2400, proteinG: 120, carbsG: 300, fatG: 70 },
      earlierMeals: [],
      consumedSoFar: { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
    };
    expect(looksLikeHandoffReply(buildHandoffPrompt(ctx, { hasPhoto: true }))).toBe(false);
  });
});
