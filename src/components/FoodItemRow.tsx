import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { itemMacros, round, stepFor } from '@/lib/nutrition';
import type { FoodItem } from '@/lib/types';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radius } from '@/theme/tokens';
import { tap, Txt } from './ui';

/** Numeric text field that only commits a valid number on blur/submit. */
function NumberField({
  value,
  onCommit,
  width,
  suffix,
}: {
  value: number;
  onCommit: (n: number) => void;
  width: number;
  suffix?: string;
}) {
  const { c } = useTheme();
  const [text, setText] = useState(String(round(value, 2)));
  useEffect(() => setText(String(round(value, 2))), [value]);
  const commit = () => {
    const n = Number(text.replace(',', '.'));
    if (Number.isFinite(n) && n >= 0) onCommit(n);
    else setText(String(round(value, 2)));
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
      <TextInput
        value={text}
        onChangeText={setText}
        onBlur={commit}
        onSubmitEditing={commit}
        keyboardType="decimal-pad"
        selectTextOnFocus
        style={[styles.num, { width, color: c.text, backgroundColor: c.bgSoft }]}
      />
      {suffix ? <Txt variant="caption"> {suffix}</Txt> : null}
    </View>
  );
}

export function FoodItemRow({
  item,
  onChange,
  onRemove,
}: {
  item: FoodItem;
  onChange: (next: FoodItem) => void;
  onRemove: () => void;
}) {
  const { c } = useTheme();
  const m = itemMacros(item);
  const step = stepFor(item.unit, item.quantity);
  const setQty = (q: number) => onChange({ ...item, quantity: Math.max(0, round(q, 2)) });

  // Editing the total kcal rescales the per-unit value (and macros proportionally).
  const setKcal = (kcal: number) => {
    const q = item.quantity > 0 ? item.quantity : 1;
    const factor = item.kcalPerUnit > 0 ? kcal / q / item.kcalPerUnit : 0;
    onChange({
      ...item,
      quantity: q,
      kcalPerUnit: kcal / q,
      proteinPerUnit: factor ? item.proteinPerUnit * factor : item.proteinPerUnit,
      carbsPerUnit: factor ? item.carbsPerUnit * factor : item.carbsPerUnit,
      fatPerUnit: factor ? item.fatPerUnit * factor : item.fatPerUnit,
    });
  };

  const lowConfidence = item.confidence != null && item.confidence < 0.6;

  return (
    <View style={[styles.row, { borderColor: c.border, backgroundColor: c.card }]}>
      <View style={styles.top}>
        <TextInput
          value={item.name}
          onChangeText={(name) => onChange({ ...item, name })}
          placeholder="Food name"
          placeholderTextColor={c.textFaint}
          style={[styles.name, { color: c.text }]}
        />
        <Pressable onPress={onRemove} hitSlop={10}>
          <Ionicons name="close-circle" size={22} color={c.textFaint} />
        </Pressable>
      </View>
      {item.portion || lowConfidence ? (
        <Txt variant="caption" faint>
          {item.portion}
          {lowConfidence ? '  · not so sure 🤔' : ''}
        </Txt>
      ) : null}

      <View style={styles.controls}>
        <View style={[styles.stepper, { backgroundColor: c.bgSoft }]}>
          <Pressable
            onPress={() => {
              tap();
              setQty(item.quantity - step);
            }}
            style={[styles.stepBtn, { backgroundColor: c.card }]}
          >
            <Ionicons name="remove" size={16} color={c.text} />
          </Pressable>
          <NumberField value={item.quantity} onCommit={setQty} width={52} />
          <Pressable
            onPress={() => {
              tap();
              setQty(item.quantity + step);
            }}
            style={[styles.stepBtn, { backgroundColor: c.sakura }]}
          >
            <Ionicons name="add" size={16} color={c.onAccent} />
          </Pressable>
        </View>
        <TextInput
          value={item.unit}
          onChangeText={(unit) => onChange({ ...item, unit })}
          style={[styles.unit, { color: c.textSoft, borderColor: c.border }]}
        />
        <View style={{ flex: 1 }} />
        <NumberField value={round(m.kcal)} onCommit={setKcal} width={64} suffix="kcal" />
      </View>

      <Txt variant="caption" faint>
        P {round(m.proteinG, 1)}g · C {round(m.carbsG, 1)}g · F {round(m.fatG, 1)}g
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { borderWidth: 1, borderRadius: radius.md, padding: 14, gap: 8 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, fontFamily: fonts.bold, fontSize: 16, padding: 0 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepper: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.pill, padding: 3, gap: 2 },
  stepBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  num: {
    fontFamily: fonts.bold,
    fontSize: 15,
    textAlign: 'center',
    paddingVertical: 4,
    borderRadius: 10,
  },
  unit: {
    fontFamily: fonts.medium,
    fontSize: 13,
    minWidth: 56,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderRadius: 10,
  },
});
