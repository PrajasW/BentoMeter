import type { Activity, FoodItem, Goal, Macros, Meal, Profile, Sex, Targets } from './types';

export const ACTIVITY_META: Record<Activity, { label: string; hint: string; factor: number }> = {
  sedentary: { label: 'Sedentary', hint: 'Desk life, little exercise', factor: 1.2 },
  light: { label: 'Light', hint: 'Exercise 1–3 days/week', factor: 1.375 },
  moderate: { label: 'Moderate', hint: 'Exercise 3–5 days/week', factor: 1.55 },
  active: { label: 'Active', hint: 'Hard exercise 6–7 days/week', factor: 1.725 },
  very_active: { label: 'Very active', hint: 'Athlete or physical job', factor: 1.9 },
};

export const GOAL_META: Record<Goal, { label: string; jp: string; delta: number }> = {
  lose: { label: 'Lose weight', jp: 'へらす', delta: -500 },
  maintain: { label: 'Maintain', jp: 'キープ', delta: 0 },
  gain: { label: 'Gain', jp: 'ふやす', delta: 300 },
};

const MIN_TARGET = 1200;

/** Mifflin-St Jeor basal metabolic rate (kcal/day). */
export function bmr(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  const offset = sex === 'male' ? 5 : sex === 'female' ? -161 : -78;
  return base + offset;
}

export function tdee(p: Pick<Profile, 'sex' | 'weightKg' | 'heightCm' | 'age' | 'activity'>): number {
  return bmr(p.sex, p.weightKg, p.heightCm, p.age) * ACTIVITY_META[p.activity].factor;
}

export function calculatedTarget(p: Profile): number {
  const raw = tdee(p) + GOAL_META[p.goal].delta;
  return Math.max(MIN_TARGET, Math.round(raw / 10) * 10);
}

export function targetsFor(p: Profile): Targets {
  const kcal = p.targetOverride ?? calculatedTarget(p);
  const proteinG = Math.round(p.weightKg * (p.goal === 'maintain' ? 1.4 : 1.6));
  const fatG = Math.round((kcal * 0.27) / 9);
  const carbsG = Math.max(0, Math.round((kcal - proteinG * 4 - fatG * 9) / 4));
  return { kcal, proteinG, carbsG, fatG };
}

export const ZERO: Macros = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };

export function itemMacros(item: FoodItem): Macros {
  const q = item.quantity;
  return {
    kcal: item.kcalPerUnit * q,
    proteinG: item.proteinPerUnit * q,
    carbsG: item.carbsPerUnit * q,
    fatG: item.fatPerUnit * q,
  };
}

export function addMacros(a: Macros, b: Macros): Macros {
  return {
    kcal: a.kcal + b.kcal,
    proteinG: a.proteinG + b.proteinG,
    carbsG: a.carbsG + b.carbsG,
    fatG: a.fatG + b.fatG,
  };
}

export function itemsTotals(items: FoodItem[]): Macros {
  return items.map(itemMacros).reduce(addMacros, ZERO);
}

export function mealsTotals(meals: Pick<Meal, 'items'>[]): Macros {
  return meals.map((m) => itemsTotals(m.items)).reduce(addMacros, ZERO);
}

/** Convert whole-portion values (as Gemini returns them) to per-unit values. */
export function toPerUnit(
  quantity: number,
  totals: { kcal: number; proteinG: number; carbsG: number; fatG: number },
) {
  const q = quantity > 0 ? quantity : 1;
  return {
    quantity: q,
    kcalPerUnit: totals.kcal / q,
    proteinPerUnit: totals.proteinG / q,
    carbsPerUnit: totals.carbsG / q,
    fatPerUnit: totals.fatG / q,
  };
}

/** Sensible stepper increment for a quantity in a given unit. */
export function stepFor(unit: string, quantity: number): number {
  const u = unit.trim().toLowerCase();
  if (['g', 'gram', 'grams', 'ml'].includes(u)) return quantity >= 100 ? 25 : 10;
  if (quantity >= 10) return 1;
  return 0.5;
}

export function round(n: number, digits = 0): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

/** Whether edits moved the meal enough that the recommendation is likely stale. */
export function isStale(originalKcal: number, currentKcal: number, threshold = 0.15): boolean {
  if (originalKcal <= 0) return currentKcal > 0;
  return Math.abs(currentKcal - originalKcal) / originalKcal > threshold;
}
