import { getMealsForDate } from './db';
import { formatTime } from './dates';
import type { MessContext } from './mess';
import type { DayContext } from './prompt';
import { itemsTotals, mealsTotals, targetsFor } from './nutrition';
import type { Profile, Slot } from './types';

/** Everything Gemini needs to know about the rest of the day. */
export async function buildDayContext(args: {
  profile: Profile;
  date: string;
  slot: Slot;
  eatenAt: Date;
  excludeMealId?: string | null;
  note?: string;
  mess?: MessContext | null;
}): Promise<DayContext> {
  const all = await getMealsForDate(args.date);
  const earlier = all.filter((m) => m.id !== args.excludeMealId && new Date(m.eatenAt) <= args.eatenAt);
  return {
    now: new Date(),
    slot: args.slot,
    eatenAt: args.eatenAt,
    profile: args.profile,
    targets: targetsFor(args.profile),
    earlierMeals: earlier.map((m) => ({
      slot: m.slot,
      time: formatTime(new Date(m.eatenAt)),
      summary: m.dishSummary || m.items.map((i) => i.name).join(', '),
      kcal: itemsTotals(m.items).kcal,
    })),
    consumedSoFar: mealsTotals(earlier),
    note: args.note,
    mess: args.mess ?? null,
  };
}
