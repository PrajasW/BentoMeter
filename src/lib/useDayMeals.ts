import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { getMealsForDate } from './db';
import type { Meal } from './types';

/** Meals for a day, reloaded on focus and after any meal write. */
export function useDayMeals(date: string) {
  const version = useAppStore((s) => s.dataVersion);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      getMealsForDate(date)
        .then((m) => alive && setMeals(m))
        .finally(() => alive && setLoading(false));
      return () => {
        alive = false;
      };
    }, [date, version]),
  );

  return { meals, loading };
}
