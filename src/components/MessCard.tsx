import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Switch, View } from 'react-native';
import { formatTime } from '@/lib/dates';
import { MESSES, messInfo, type MessId, type MessMeal } from '@/lib/mess';
import type { MessMenuState } from '@/lib/useMessMenu';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';
import { Card, Row, tap, Txt } from './ui';

const MEAL_LABEL: Record<MessMeal, string> = {
  breakfast: 'breakfast',
  lunch: 'lunch',
  snacks: 'snacks',
  dinner: 'dinner',
};

/** "At the mess" toggle + mess dropdown + menu preview for the Log-a-meal screen. */
export function MessCard({
  meal,
  state,
  on,
  onToggle,
  messId,
  pickedByUser,
  onPick,
}: {
  meal: MessMeal;
  state: MessMenuState;
  on: boolean;
  onToggle: (v: boolean) => void;
  messId: MessId;
  pickedByUser: boolean;
  onPick: (id: MessId) => void;
}) {
  const { c } = useTheme();
  const [sheet, setSheet] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const info = messInfo(messId);
  const items = state.menus?.[messId]?.[meal] ?? [];
  const reg = state.registration;

  const source = (() => {
    if (state.keyRejected) return 'Dining key rejected, check Settings';
    if (!pickedByUser && reg?.mess === messId && !reg.cancelled) {
      return reg.availedAt ? `Registered · checked in ${formatTime(new Date(reg.availedAt))}` : 'Registered';
    }
    if (pickedByUser) return 'Picked by you';
    if (state.registrationKnown && meal !== 'snacks') return `Not registered for ${MEAL_LABEL[meal]}`;
    return 'Default';
  })();

  const status = (() => {
    if (state.loading) return null;
    if (!state.menus) return "Couldn't load the menu, so it'll analyze without it.";
    if (!items.length) return `No ${MEAL_LABEL[meal]} menu at ${info.label}, so it'll analyze without it.`;
    if (state.fromCache) return 'Offline, using the saved menu.';
    return null;
  })();

  return (
    <Card tint={on ? c.yuzuSoft : c.card} style={{ gap: 10, borderColor: on ? c.yuzuSoft : c.border, paddingVertical: 12 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Txt variant="bodyBold">🍛 At the mess</Txt>
          <Txt variant="jp">しょくどう · uses the menu as a hint</Txt>
        </View>
        <Switch
          value={on}
          onValueChange={(v) => {
            tap();
            onToggle(v);
          }}
          trackColor={{ true: c.sakura, false: c.border }}
          thumbColor="#fff"
        />
      </Row>

      {on ? (
        <>
          <Row gap={10}>
            <Pressable
              onPress={() => {
                tap();
                setSheet(true);
              }}
              style={({ pressed }) => [
                styles.pill,
                { backgroundColor: c.card, borderColor: c.sakura, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Txt variant="bodyBold">{info.label}</Txt>
              <Ionicons name="chevron-down" size={16} color={c.sakura} />
            </Pressable>
            <Txt variant="caption" style={{ flex: 1 }} numberOfLines={2}>
              {source}
            </Txt>
          </Row>

          {state.loading ? (
            <Row>
              <ActivityIndicator size="small" color={c.sakura} />
              <Txt variant="caption">Peeking at the menu…</Txt>
            </Row>
          ) : null}

          {items.length ? (
            <Pressable onPress={() => setExpanded((v) => !v)} hitSlop={6}>
              <Row gap={4}>
                <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={c.textSoft} />
                <Txt variant="caption">
                  {expanded ? 'Hide' : 'See'} {MEAL_LABEL[meal]} menu ({items.length})
                </Txt>
              </Row>
            </Pressable>
          ) : null}

          {expanded && items.length ? (
            <View style={[styles.menu, { backgroundColor: c.card }]}>
              {items.map((i, n) => (
                <Row key={`${i.item}-${n}`} gap={8} style={{ alignItems: 'flex-start' }}>
                  <Txt variant="caption" faint style={{ width: 92 }} numberOfLines={1}>
                    {i.category}
                  </Txt>
                  <Txt variant="caption" style={{ flex: 1, color: c.text }}>
                    {i.item}
                  </Txt>
                </Row>
              ))}
              {info.extras[meal]?.length ? (
                <Txt variant="caption" style={{ marginTop: 4 }}>
                  ✨ Extras here: {info.extras[meal]!.join(', ')}
                </Txt>
              ) : null}
            </View>
          ) : null}

          {state.boughtExtras.length ? (
            <Txt variant="caption">🥚 You bought: {state.boughtExtras.join(', ')}</Txt>
          ) : null}

          {status ? (
            <Txt variant="caption" faint>
              {status}
            </Txt>
          ) : null}
        </>
      ) : null}

      <Modal visible={sheet} transparent animationType="fade" onRequestClose={() => setSheet(false)}>
        <Pressable style={styles.backdrop} onPress={() => setSheet(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={{ marginBottom: 6 }}>
              <Txt variant="h2">Which mess?</Txt>
              <Txt variant="jp">どこのしょくどう？</Txt>
            </View>
            {MESSES.map((m) => {
              const selected = m.id === messId;
              const has = !!state.menus?.[m.id]?.[meal]?.length;
              const registered = reg?.mess === m.id && !reg.cancelled;
              return (
                <Pressable
                  key={m.id}
                  onPress={() => {
                    tap();
                    onPick(m.id);
                    setSheet(false);
                  }}
                  style={({ pressed }) => [
                    styles.option,
                    {
                      backgroundColor: selected ? c.sakuraSoft : 'transparent',
                      borderColor: selected ? c.sakura : c.border,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Txt variant="bodyBold">{m.label}</Txt>
                    <Txt variant="caption" faint>
                      {[
                        m.menuId.endsWith('nonveg') ? 'Veg + non-veg menu' : null,
                        registered ? 'Registered' : null,
                        state.menus && !has ? `No ${MEAL_LABEL[meal]} menu` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ') || ' '}
                    </Txt>
                  </View>
                  {selected ? <Ionicons name="checkmark-circle" size={22} color={c.sakura} /> : null}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </Card>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  menu: { borderRadius: radius.sm, padding: 12, gap: 6 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(30, 20, 30, 0.35)' },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    padding: 20,
    paddingBottom: 36,
    gap: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 56,
  },
});

