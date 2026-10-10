export type Slot = 'breakfast' | 'lunch' | 'snack' | 'dinner' | 'latenight';

export type Sex = 'male' | 'female' | 'other';
export type Activity = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type Goal = 'lose' | 'maintain' | 'gain';

export interface Profile {
  name: string;
  age: number;
  sex: Sex;
  heightCm: number;
  weightKg: number;
  activity: Activity;
  goal: Goal;
  /** Manual calorie target; null means "use the calculated one". */
  targetOverride: number | null;
}

export interface Targets {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface Macros {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

/** Nutrition is stored per unit so changing the quantity rescales locally. */
export interface FoodItem {
  id: string;
  name: string;
  portion: string;
  quantity: number;
  unit: string;
  kcalPerUnit: number;
  proteinPerUnit: number;
  carbsPerUnit: number;
  fatPerUnit: number;
  confidence: number | null;
}

export interface RecommendationIdea {
  name: string;
  kcal: number;
  why: string;
}

export interface Recommendation {
  nextMeal: Slot;
  suggestedTime: string;
  kcalBudget: number;
  ideas: RecommendationIdea[];
  tip: string;
}

export interface Meal {
  id: string;
  /** Local calendar day, YYYY-MM-DD. */
  date: string;
  slot: Slot;
  /** ISO timestamp of when the meal was eaten. */
  eatenAt: string;
  photoUri: string | null;
  note: string;
  dishSummary: string;
  recommendation: Recommendation | null;
  modelUsed: string | null;
  items: FoodItem[];
  createdAt: string;
  updatedAt: string;
}

export type ThemePref = 'system' | 'light' | 'dark';
