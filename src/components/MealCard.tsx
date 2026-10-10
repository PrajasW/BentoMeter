import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';
import { formatTime } from '@/lib/dates';
import { SLOT_META } from '@/lib/mealSlot';
import { itemsTotals } from '@/lib/nutrition';
import type { Meal } from '@/lib/types';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';
import { tap, Txt } from './ui';

export function MealCard({ meal, onPress }: { meal: Meal; onPress: () => void }) {
  const { c } = useTheme();
  const t = itemsTotals(meal.items);
  const meta = SLOT_META[meal.slot];
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [styles.card, { backgroundColor: c.card, borderColor: c.border, opacity: pressed ? 0.85 : 1 }]}
    >
      {meal.photoUri ? (
        <Image source={{ uri: meal.photoUri }} style={styles.thumb} contentFit="cover" />
      ) : (
        <View style={[styles.thumb, { backgroundColor: c.bgSoft, alignItems: 'center', justifyContent: 'center' }]}>
          <Txt style={{ fontSize: 24 }}>{meta.emoji}</Txt>
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="caption">
          {meta.label} · {formatTime(new Date(meal.eatenAt))}
        </Txt>
        <Txt variant="bodyBold" numberOfLines={1}>
          {meal.dishSummary || 'Meal'}
        </Txt>
        <Txt variant="caption" faint numberOfLines={1}>
          P {Math.round(t.proteinG)} · C {Math.round(t.carbsG)} · F {Math.round(t.fatG)}
        </Txt>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Txt variant="number" style={{ fontSize: 18 }}>
          {Math.round(t.kcal)}
        </Txt>
        <Txt variant="caption">kcal</Txt>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    paddingRight: 16,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  thumb: { width: 56, height: 56, borderRadius: radius.sm },
});
