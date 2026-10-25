import { useCallback, useEffect, useState } from 'react';
import type { DayMenus, MessMeal, Registration } from './mess';
import { DiningKeyError, fetchBoughtExtras, fetchMenusForDate, fetchRegistration } from './messApi';

export interface MessMenuState {
  loading: boolean;
  /** Null when the menu couldn't be loaded at all (offline with no saved copy). */
  menus: DayMenus | null;
  fromCache: boolean;
  /** When the shown menu was downloaded. */
  savedAt: number | null;
  /** Registration for this meal. */
  registration: Registration | null;
  /** True once a registration lookup succeeded, so a missing entry really means "not registered". */
  registrationKnown: boolean;
  keyRejected: boolean;
  boughtExtras: string[];
  /** The last ↻ Refresh couldn't reach the dining portal (usually: VPN is off). */
  refreshFailed: boolean;
}

const EMPTY: MessMenuState = {
  loading: false,
  menus: null,
  fromCache: false,
  savedAt: null,
  registration: null,
  registrationKnown: false,
  keyRejected: false,
  boughtExtras: [],
  refreshFailed: false,
};

async function loadMess(date: string, meal: MessMeal, diningKey: string | null, force: boolean): Promise<MessMenuState> {
  const [menuResult, reg, boughtExtras] = await Promise.all([
    fetchMenusForDate(date, { force }),
    fetchRegistration(date, diningKey, { force }).then(
      (r) => ({ reg: r, rejected: false }),
      (e) => ({ reg: null, rejected: e instanceof DiningKeyError }),
    ),
    fetchBoughtExtras(date, meal, diningKey),
  ]);
  const day = reg.reg;
  return {
    loading: false,
    menus: menuResult?.menus ?? null,
    fromCache: menuResult?.fromCache ?? false,
    savedAt: menuResult?.savedAt ?? null,
    registration: day?.[meal] ?? null,
    registrationKnown: !!day,
    keyRejected: reg.rejected,
    boughtExtras,
    refreshFailed: force && (!menuResult || menuResult.fromCache),
  };
}

/**
 * Loads the mess menu (and, with a dining key, the user's registration) for a date and meal.
 * Saved copies are used when the dining portal is unreachable (off campus without VPN);
 * `refresh()` forces a fresh download of the menu, registration and extras.
 */
export function useMessMenu(
  date: string,
  meal: MessMeal | null,
  diningKey: string | null,
): MessMenuState & { refresh: () => void; refreshing: boolean } {
  // Results are tagged with what they were loaded for, so a change of date/meal reads as "loading".
  const requestKey = meal ? `${date}|${meal}|${diningKey ?? ''}` : null;
  const [result, setResult] = useState<{ key: string; state: MessMenuState } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!meal || !requestKey) return;
    let alive = true;
    loadMess(date, meal, diningKey, false).then((state) => {
      if (alive) setResult({ key: requestKey, state });
    });
    return () => {
      alive = false;
    };
  }, [requestKey, date, meal, diningKey]);

  const refresh = useCallback(async () => {
    if (!meal || !requestKey) return;
    setRefreshing(true);
    try {
      setResult({ key: requestKey, state: await loadMess(date, meal, diningKey, true) });
    } finally {
      setRefreshing(false);
    }
  }, [requestKey, date, meal, diningKey]);

  const state = !requestKey ? EMPTY : result?.key === requestKey ? result.state : { ...EMPTY, loading: true };
  return { ...state, refresh, refreshing };
}
