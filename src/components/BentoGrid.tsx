import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';
import { SLOT_META } from '@/lib/mealSlot';
import { itemsTotals } from '@/lib/nutrition';
import type { Meal, Slot } from '@/lib/types';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';
import { tap, Txt } from './ui';

type Box = 'breakfast' | 'lunch' | 'dinner' | 'snacks';

const BOX_SLOTS: Record<Box, Slot[]> = {
  breakfast: ['breakfast'],
  lunch: ['lunch'],
  dinner: ['dinner'],
  snacks: ['snack', 'latenight'],
};

/**
 * The day as a bento box: one compartment per meal, snacks share a corner.
 * Empty compartments start logging that meal; full ones open the latest meal.
 */
export function BentoGrid({
  meals,
  onOpenMeal,
  onLog,
}: {
  meals: Meal[];
  onOpenMeal: (id: string) => void;
  onLog: (slot: Slot) => void;
}) {
  const { c } = useTheme();
  const tints: Record<Box, string> = {
    breakfast: c.yuzuSoft,
    lunch: c.sakuraSoft,
    dinner: c.soraSoft,
    snacks: c.matchaSoft,
  };

  const renderBox = (box: Box, style: object) => {
    const slots = BOX_SLOTS[box];
    const inBox = meals.filter((m) => slots.includes(m.slot));
    const kcal = inBox.reduce((s, m) => s + itemsTotals(m.items).kcal, 0);
    const meta = box === 'snacks' ? { label: 'Snacks', jp: 'おやつ', emoji: '🍡' } : SLOT_META[box];
    const latest = inBox[inBox.length - 1];
    const photo = [...inBox].reverse().find((m) => m.photoUri)?.photoUri;

    return (
      <Pressable
        key={box}
        onPress={() => {
          tap();
          if (latest) onOpenMeal(latest.id);
          else onLog(box === 'snacks' ? 'snack' : box);
        }}
        style={({ pressed }) => [
          styles.box,
          style,
          { backgroundColor: tints[box], borderColor: c.border, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        {photo ? <Image source={{ uri: photo }} style={styles.photo} contentFit="cover" transition={200} /> : null}
        {photo ? <View style={[StyleSheet.absoluteFill, { backgroundColor: c.bg, opacity: 0.55 }]} /> : null}
        <View style={styles.boxInner}>
          <Txt style={{ fontSize: 22 }}>{meta.emoji}</Txt>
          <View>
            <Txt variant="bodyBold">{meta.label}</Txt>
            <Txt variant="jp">{meta.jp}</Txt>
          </View>
          <View style={{ flex: 1 }} />
          {inBox.length ? (
            <Txt variant="number" style={{ fontSize: 18 }}>
              {Math.round(kcal)}
              <Txt variant="caption"> kcal{inBox.length > 1 ? ` · ${inBox.length}` : ''}</Txt>
            </Txt>
          ) : (
            <Txt variant="caption" faint>
              + tap to log
            </Txt>
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[styles.bento, { borderColor: c.border, backgroundColor: c.card }]}>
      <View style={styles.row}>
        {renderBox('breakfast', { flex: 1 })}
        {renderBox('lunch', { flex: 1.35 })}
      </View>
      <View style={styles.row}>
        {renderBox('dinner', { flex: 1.35 })}
        {renderBox('snacks', { flex: 1 })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bento: { borderRadius: radius.lg + 4, borderWidth: 1, padding: 8, gap: 8 },
  row: { flexDirection: 'row', gap: 8 },
  box: { height: 118, borderRadius: radius.md, borderWidth: 1, overflow: 'hidden' },
  boxInner: { flex: 1, padding: 12, gap: 2 },
  photo: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
});
