import type { Slot } from './types';

export const SLOT_META: Record<Slot, { label: string; jp: string; emoji: string; order: number }> = {
  breakfast: { label: 'Breakfast', jp: '朝ごはん', emoji: '🍳', order: 0 },
  lunch: { label: 'Lunch', jp: '昼ごはん', emoji: '🍱', order: 1 },
  snack: { label: 'Snack', jp: 'おやつ', emoji: '🍡', order: 2 },
  dinner: { label: 'Dinner', jp: '晩ごはん', emoji: '🍜', order: 3 },
  latenight: { label: 'Late snack', jp: '夜食', emoji: '🌙', order: 4 },
};

export const SLOTS: Slot[] = ['breakfast', 'lunch', 'snack', 'dinner', 'latenight'];

/** Meal slot implied by the clock alone. */
export function slotForTime(date: Date): Slot {
  const minutes = date.getHours() * 60 + date.getMinutes();
  if (minutes >= 5 * 60 && minutes < 11 * 60) return 'breakfast';
  if (minutes >= 11 * 60 && minutes < 16 * 60) return 'lunch';
  if (minutes >= 16 * 60 && minutes < 18 * 60 + 30) return 'snack';
  if (minutes >= 18 * 60 + 30 && minutes < 23 * 60) return 'dinner';
  return 'latenight';
}

/**
 * Slot to pre-select when logging: the clock's slot, unless that main meal
 * was already logged today, in which case it's probably a snack.
 */
export function suggestSlot(date: Date, loggedSlots: Iterable<Slot>): Slot {
  const base = slotForTime(date);
  if (base === 'snack') return base;
  const logged = new Set(loggedSlots);
  return logged.has(base) ? 'snack' : base;
}

/** Default clock time for a slot, used when back-filling a meal on another day. */
export function defaultTimeForSlot(slot: Slot): { h: number; m: number } {
  switch (slot) {
    case 'breakfast':
      return { h: 8, m: 30 };
    case 'lunch':
      return { h: 13, m: 0 };
    case 'snack':
      return { h: 17, m: 0 };
    case 'dinner':
      return { h: 20, m: 0 };
    case 'latenight':
      return { h: 23, m: 30 };
  }
}

export function greetingFor(date: Date): { en: string; jp: string } {
  const h = date.getHours();
  if (h >= 5 && h < 11) return { en: 'Good morning', jp: 'おはよう' };
  if (h >= 11 && h < 18) return { en: 'Good afternoon', jp: 'こんにちは' };
  return { en: 'Good evening', jp: 'こんばんは' };
}
