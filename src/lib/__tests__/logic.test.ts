/// <reference types="jest" />
import { addDays, dayKey, parseDayKey } from '../dates';
import { parseAnalysis } from '../prompt';
import { slotForTime, suggestSlot } from '../mealSlot';
import { bmr, calculatedTarget, isStale, itemMacros, itemsTotals, stepFor, targetsFor, toPerUnit } from '../nutrition';
import type { FoodItem, Profile } from '../types';

const at = (h: number, m = 0) => new Date(2026, 9, 9, h, m);

describe('slotForTime', () => {
  it.each([
    [4, 59, 'latenight'],
    [5, 0, 'breakfast'],
    [10, 59, 'breakfast'],
    [11, 0, 'lunch'],
    [15, 59, 'lunch'],
    [16, 0, 'snack'],
    [18, 29, 'snack'],
    [18, 30, 'dinner'],
    [22, 59, 'dinner'],
    [23, 0, 'latenight'],
    [0, 30, 'latenight'],
  ])('%i:%i → %s', (h, m, slot) => {
    expect(slotForTime(at(h, m))).toBe(slot);
  });
});

describe('suggestSlot', () => {
  it('uses the clock slot when that meal is not logged yet', () => {
    expect(suggestSlot(at(13), ['breakfast'])).toBe('lunch');
  });
  it('falls back to snack when the main meal is already logged', () => {
    expect(suggestSlot(at(14), ['breakfast', 'lunch'])).toBe('snack');
  });
  it('keeps snack time as snack', () => {
    expect(suggestSlot(at(17), ['snack'])).toBe('snack');
  });
});

const profile: Profile = {
  name: '',
  age: 25,
  sex: 'male',
  heightCm: 175,
  weightKg: 70,
  activity: 'moderate',
  goal: 'maintain',
  targetOverride: null,
};

describe('targets', () => {
  it('computes Mifflin-St Jeor BMR', () => {
    // 10*70 + 6.25*175 - 5*25 + 5 = 1673.75
    expect(bmr('male', 70, 175, 25)).toBeCloseTo(1673.75);
    expect(bmr('female', 70, 175, 25)).toBeCloseTo(1507.75);
  });
  it('applies activity factor, goal delta and rounds to 10', () => {
    expect(calculatedTarget(profile)).toBe(2590); // 1673.75 * 1.55 = 2594.3
    expect(calculatedTarget({ ...profile, goal: 'lose' })).toBe(2090);
  });
  it('never goes below the safety floor', () => {
    expect(calculatedTarget({ ...profile, sex: 'female', weightKg: 40, heightCm: 145, age: 70, activity: 'sedentary', goal: 'lose' })).toBe(1200);
  });
  it('honours a manual override and derives macros that add up', () => {
    const t = targetsFor({ ...profile, targetOverride: 2000 });
    expect(t.kcal).toBe(2000);
    const fromMacros = t.proteinG * 4 + t.carbsG * 4 + t.fatG * 9;
    expect(Math.abs(fromMacros - 2000)).toBeLessThan(15);
  });
});

describe('per-unit scaling', () => {
  const item: FoodItem = {
    id: 'a',
    name: 'Roti',
    portion: '',
    unit: 'piece',
    confidence: 0.9,
    ...toPerUnit(2, { kcal: 240, proteinG: 8, carbsG: 44, fatG: 4 }),
  };
  it('stores whole-portion values per unit', () => {
    expect(item.kcalPerUnit).toBe(120);
    expect(itemMacros(item).kcal).toBe(240);
  });
  it('rescales when quantity changes, without another API call', () => {
    expect(itemMacros({ ...item, quantity: 3 })).toEqual({ kcal: 360, proteinG: 12, carbsG: 66, fatG: 6 });
    expect(itemsTotals([item, { ...item, id: 'b', quantity: 1 }]).kcal).toBe(360);
  });
  it('treats a zero quantity from the model as 1', () => {
    expect(toPerUnit(0, { kcal: 100, proteinG: 0, carbsG: 0, fatG: 0 }).kcalPerUnit).toBe(100);
  });
  it('picks stepper increments by unit', () => {
    expect(stepFor('g', 150)).toBe(25);
    expect(stepFor('g', 40)).toBe(10);
    expect(stepFor('piece', 2)).toBe(0.5);
  });
  it('flags a recommendation as stale after big edits only', () => {
    expect(isStale(500, 540)).toBe(false);
    expect(isStale(500, 700)).toBe(true);
  });
});

describe('parseAnalysis', () => {
  it('sanitises model output', () => {
    const r = parseAnalysis({
      dish_summary: ' Dal & roti ',
      items: [
        { name: 'Roti', portion: '2 medium', quantity: 2, unit: 'piece', kcal: 240, protein_g: 8, carbs_g: 44, fat_g: 4, confidence: 0.9 },
        { name: 'Dal', quantity: '1', unit: '', kcal: -5, protein_g: 'x' },
      ],
      recommendation: { next_meal: 'brunch', suggested_time: '19:30', kcal_budget: 600.4, ideas: [{ name: 'Paneer tikka', kcal: 300, why: 'protein' }], tip: 'Yay' },
    });
    expect(r.dishSummary).toBe('Dal & roti');
    expect(r.items[0].kcalPerUnit).toBe(120);
    expect(r.items[1]).toMatchObject({ quantity: 1, unit: 'serving', kcalPerUnit: 0, proteinPerUnit: 0, confidence: null });
    expect(r.recommendation).toMatchObject({ nextMeal: 'snack', kcalBudget: 600 });
  });
});

describe('dates', () => {
  it('round-trips day keys and adds days across months', () => {
    expect(dayKey(parseDayKey('2026-10-09'))).toBe('2026-10-09');
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});
