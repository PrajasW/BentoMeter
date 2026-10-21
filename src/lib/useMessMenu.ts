import { useEffect, useState } from 'react';
import type { DayMenus, MessMeal, Registration } from './mess';
import { DiningKeyError, fetchBoughtExtras, fetchMenusForDate, fetchRegistration } from './messApi';

export interface MessMenuState {
  loading: boolean;
  /** Null when the menu couldn't be loaded at all (offline with no saved copy). */
  menus: DayMenus | null;
  fromCache: boolean;
  /** Registration for this meal; for snacks, the lunch/dinner registration of the day. */
  registration: Registration | null;
  /** True once a registration lookup succeeded, so a missing entry really means "not registered". */
  registrationKnown: boolean;
  keyRejected: boolean;
  boughtExtras: string[];
}

const EMPTY: MessMenuState = {
  loading: false,
  menus: null,
  fromCache: false,
  registration: null,
  registrationKnown: false,
  keyRejected: false,
  boughtExtras: [],
};

/** Loads the mess menu (and, with a dining key, the user's registration) for a date and meal. */
export function useMessMenu(date: string, meal: MessMeal | null, diningKey: string | null): MessMenuState {
  // Results are tagged with what they were loaded for, so a change of date/meal reads as "loading".
  const requestKey = meal ? `${date}|${meal}|${diningKey ?? ''}` : null;
  const [result, setResult] = useState<{ key: string; state: MessMenuState } | null>(null);

  useEffect(() => {
    if (!meal || !requestKey) return;
    let alive = true;
    (async () => {
      const [menuResult, reg, boughtExtras] = await Promise.all([
        fetchMenusForDate(date),
        fetchRegistration(date, diningKey).then(
          (r) => ({ reg: r, rejected: false }),
          (e) => ({ reg: null, rejected: e instanceof DiningKeyError }),
        ),
        fetchBoughtExtras(date, meal, diningKey),
      ]);
      if (!alive) return;
      const day = reg.reg;
      const registration = day
        ? (day[meal] ?? (meal === 'snacks' ? (day.lunch ?? day.dinner ?? null) : null))
        : null;
      setResult({
        key: requestKey,
        state: {
          loading: false,
          menus: menuResult?.menus ?? null,
          fromCache: menuResult?.fromCache ?? false,
          registration,
          registrationKnown: !!day,
          keyRejected: reg.rejected,
          boughtExtras,
        },
      });
    })();
    return () => {
      alive = false;
    };
  }, [requestKey, date, meal, diningKey]);

  if (!requestKey) return EMPTY;
  if (result?.key === requestKey) return result.state;
  return { ...EMPTY, loading: true };
}
