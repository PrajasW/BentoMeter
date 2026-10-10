import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Card, Row, Screen, tap, Txt } from '@/components/ui';
import { dayKey, parseDayKey, todayKey } from '@/lib/dates';
import { getDailyKcal } from '@/lib/db';
import { targetsFor } from '@/lib/nutrition';
import { useAppStore } from '@/store/useAppStore';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const BAR_H = 116;
const LABEL_H = 24;

export default function History() {
  const { c } = useTheme();
  const profile = useAppStore((s) => s.profile)!;
  const version = useAppStore((s) => s.dataVersion);
  const setSelectedDate = useAppStore((s) => s.setSelectedDate);
  const target = targetsFor(profile).kcal;

  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [kcalByDay, setKcalByDay] = useState<Record<string, number>>({});
  const [week, setWeek] = useState<{ key: string; kcal: number }[]>([]);

  const first = dayKey(month);
  const last = dayKey(new Date(month.getFullYear(), month.getMonth() + 1, 0));

  useFocusEffect(
    useCallback(() => {
      getDailyKcal(first, last).then(setKcalByDay);
      const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return dayKey(d);
      });
      getDailyKcal(days[0], days[6]).then((map) => setWeek(days.map((key) => ({ key, kcal: map[key] ?? 0 }))));
    }, [first, last, version]),
  );

  const logged = week.filter((d) => d.kcal > 0);
  const avg = logged.length ? Math.round(logged.reduce((s, d) => s + d.kcal, 0) / logged.length) : 0;
  const maxBar = Math.max(target * 1.2, ...week.map((d) => d.kcal));

  // Monday-first calendar grid.
  const offset = (month.getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (string | null)[] = [
    ...Array<null>(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => dayKey(new Date(month.getFullYear(), month.getMonth(), i + 1))),
  ];
  const today = todayKey();

  const openDay = (key: string) => {
    tap();
    setSelectedDate(key);
    router.navigate('/');
  };

  const dotColor = (kcal: number) => {
    if (kcal <= 0) return 'transparent';
    const r = kcal / target;
    if (r > 1.1) return c.danger;
    if (r >= 0.85) return c.matcha;
    return c.yuzu;
  };

  return (
    <Screen>
      <View>
        <Txt variant="jp">きろく</Txt>
        <Txt variant="title">History</Txt>
      </View>

      <Card style={{ gap: 14 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt variant="h2">Last 7 days</Txt>
          <Txt variant="caption">avg {avg.toLocaleString()} kcal</Txt>
        </Row>
        <View style={styles.chart}>
          <View
            style={[styles.targetLine, { bottom: LABEL_H + (target / maxBar) * BAR_H, borderColor: c.sakura }]}
            pointerEvents="none"
          />
          {week.map((d) => (
            <Pressable key={d.key} style={styles.barCol} onPress={() => openDay(d.key)}>
              <View style={{ height: BAR_H, justifyContent: 'flex-end', width: '100%', alignItems: 'center' }}>
                <View
                  style={{
                    width: 18,
                    height: `${Math.max(2, (d.kcal / maxBar) * 100)}%`,
                    borderRadius: 9,
                    backgroundColor: d.kcal > target * 1.1 ? c.danger : d.kcal > 0 ? c.sakura : c.ringTrack,
                  }}
                />
              </View>
              <Txt
                variant="caption"
                style={[{ height: LABEL_H, paddingTop: 6 }, d.key === today && { color: c.sakura, fontFamily: fonts.heavy }]}
              >
                {WEEKDAYS[(parseDayKey(d.key).getDay() + 6) % 7]}
              </Txt>
            </Pressable>
          ))}
        </View>
        <Txt variant="caption" faint>
          Pink line = your {target.toLocaleString()} kcal target
        </Txt>
      </Card>

      <Card style={{ gap: 12 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Pressable hitSlop={12} onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
            <Ionicons name="chevron-back" size={20} color={c.textSoft} />
          </Pressable>
          <Txt variant="h2">{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Txt>
          <Pressable hitSlop={12} onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
            <Ionicons name="chevron-forward" size={20} color={c.textSoft} />
          </Pressable>
        </Row>
        <View style={styles.grid}>
          {WEEKDAYS.map((w, i) => (
            <View key={`h${i}`} style={styles.cell}>
              <Txt variant="caption" faint>
                {w}
              </Txt>
            </View>
          ))}
          {cells.map((key, i) => {
            if (!key) return <View key={`e${i}`} style={styles.cell} />;
            const kcal = kcalByDay[key] ?? 0;
            const future = key > today;
            return (
              <Pressable key={key} style={styles.cell} disabled={future} onPress={() => openDay(key)}>
                <View
                  style={[
                    styles.dayCircle,
                    key === today && { borderColor: c.sakura, borderWidth: 2 },
                    kcal > 0 && { backgroundColor: c.bgSoft },
                  ]}
                >
                  <Txt variant="caption" style={{ color: future ? c.textFaint : c.text }}>
                    {Number(key.slice(8))}
                  </Txt>
                </View>
                <View style={[styles.dot, { backgroundColor: dotColor(kcal) }]} />
              </Pressable>
            );
          })}
        </View>
        <Row gap={14} style={{ justifyContent: 'center' }}>
          <Legend color={c.yuzu} label="under" />
          <Legend color={c.matcha} label="on target" />
          <Legend color={c.danger} label="over" />
        </Row>
      </Card>
    </Screen>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <Row gap={4}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Txt variant="caption">{label}</Txt>
    </Row>
  );
}

const styles = StyleSheet.create({
  chart: { flexDirection: 'row', height: BAR_H + LABEL_H, gap: 6 },
  barCol: { flex: 1, alignItems: 'center', gap: 0 },
  targetLine: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1.5, borderStyle: 'dashed' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.28%', alignItems: 'center', paddingVertical: 4, gap: 3 },
  dayCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
