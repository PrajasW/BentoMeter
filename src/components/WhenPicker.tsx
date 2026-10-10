import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import { dayKey, formatDayLabel, formatTime } from '@/lib/dates';
import { SLOT_META, SLOTS } from '@/lib/mealSlot';
import type { Slot } from '@/lib/types';
import { Chip, Row, Txt } from './ui';

/** Slot chips + date/time chips used when logging or editing a meal. */
export function WhenPicker({
  slot,
  onSlot,
  when,
  onWhen,
}: {
  slot: Slot;
  onSlot: (s: Slot) => void;
  when: Date;
  onWhen: (d: Date) => void;
}) {
  const [mode, setMode] = useState<'date' | 'time' | null>(null);

  const onChange = (e: DateTimePickerEvent, d?: Date) => {
    if (Platform.OS === 'android') setMode(null);
    if (e.type === 'set' && d) onWhen(d);
    if (e.type === 'dismissed') setMode(null);
  };

  return (
    <View style={{ gap: 10 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {SLOTS.map((s) => (
          <Chip
            key={s}
            label={`${SLOT_META[s].emoji} ${SLOT_META[s].label}`}
            selected={s === slot}
            onPress={() => onSlot(s)}
          />
        ))}
      </ScrollView>
      <Row>
        <Txt variant="caption">When</Txt>
        <Chip label={`📅 ${formatDayLabel(dayKey(when))}`} onPress={() => setMode(mode === 'date' ? null : 'date')} />
        <Chip label={`🕐 ${formatTime(when)}`} onPress={() => setMode(mode === 'time' ? null : 'time')} />
      </Row>
      {mode && Platform.OS !== 'web' ? (
        <DateTimePicker
          value={when}
          mode={mode}
          maximumDate={mode === 'date' ? new Date() : undefined}
          display={Platform.OS === 'ios' ? (mode === 'date' ? 'inline' : 'spinner') : 'default'}
          onChange={onChange}
        />
      ) : null}
    </View>
  );
}
