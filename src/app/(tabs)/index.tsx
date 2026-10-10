import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { BentoGrid } from '@/components/BentoGrid';
import { CalorieRing } from '@/components/CalorieRing';
import { MacroBars } from '@/components/MacroBars';
import { Mascot, moodFor } from '@/components/Mascot';
import { MealCard } from '@/components/MealCard';
import { RecommendationCard } from '@/components/RecommendationCard';
import { Button, Card, Chip, Row, Screen, tap, Txt } from '@/components/ui';
import { addDays, formatDayLabel, todayKey } from '@/lib/dates';
import { greetingFor, SLOT_META, suggestSlot } from '@/lib/mealSlot';
import { mealsTotals, targetsFor } from '@/lib/nutrition';
import { useDayMeals } from '@/lib/useDayMeals';
import type { Slot } from '@/lib/types';
import { useAppStore } from '@/store/useAppStore';
import { useTheme } from '@/theme/ThemeProvider';

export default function Today() {
  const { c } = useTheme();
  const profile = useAppStore((s) => s.profile)!;
  const date = useAppStore((s) => s.selectedDate);
  const setDate = useAppStore((s) => s.setSelectedDate);
  const { meals } = useDayMeals(date);

  const today = todayKey();
  const isToday = date === today;
  const now = new Date();
  const targets = targetsFor(profile);
  const totals = mealsTotals(meals);
  const nextSlot = isToday ? suggestSlot(now, meals.map((m) => m.slot)) : null;
  const greeting = greetingFor(now);

  // Latest advice of the day comes from the most recently eaten meal that has one.
  const rec = [...meals].reverse().find((m) => m.recommendation)?.recommendation ?? null;

  const log = (slot?: Slot) => router.push({ pathname: '/capture', params: { date, ...(slot ? { slot } : {}) } });

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Txt variant="jp">{greeting.jp}</Txt>
          <Txt variant="title">
            {greeting.en}
            {profile.name ? `, ${profile.name}` : ''}
          </Txt>
        </View>
        <Mascot size={56} mood={moodFor(totals.kcal, targets.kcal)} />
      </Row>

      <Row style={{ justifyContent: 'space-between' }}>
        <Pressable
          hitSlop={12}
          onPress={() => {
            tap();
            setDate(addDays(date, -1));
          }}
        >
          <Ionicons name="chevron-back" size={22} color={c.textSoft} />
        </Pressable>
        <Row>
          <Txt variant="h2">{formatDayLabel(date)}</Txt>
          {!isToday ? <Chip label="Back to today" onPress={() => setDate(today)} /> : null}
        </Row>
        {isToday ? (
          <View style={{ width: 22 }} />
        ) : (
          <Pressable
            hitSlop={12}
            onPress={() => {
              tap();
              setDate(addDays(date, 1));
            }}
          >
            <Ionicons name="chevron-forward" size={22} color={c.textSoft} />
          </Pressable>
        )}
      </Row>

      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
        <CalorieRing consumed={totals.kcal} target={targets.kcal} size={150} />
        <View style={{ flex: 1, gap: 12 }}>
          <View>
            <Txt variant="caption">Eaten · たべた</Txt>
            <Txt variant="number">
              {Math.round(totals.kcal).toLocaleString()}
              <Txt variant="caption"> / {targets.kcal.toLocaleString()}</Txt>
            </Txt>
          </View>
          <MacroBars totals={totals} targets={targets} />
        </View>
      </Card>

      {nextSlot ? (
        <Button
          title={`Log ${SLOT_META[nextSlot].label}`}
          icon={<Ionicons name="camera" size={20} color={c.onAccent} />}
          onPress={() => log(nextSlot)}
        />
      ) : (
        <Button title="Add a meal to this day" icon={<Ionicons name="add" size={20} color={c.onAccent} />} onPress={() => log()} />
      )}

      <BentoGrid meals={meals} onOpenMeal={(id) => router.push(`/meal/${id}`)} onLog={log} />

      {isToday && rec ? <RecommendationCard rec={rec} /> : null}

      <View style={{ gap: 10 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View>
            <Txt variant="h2">Meals</Txt>
            <Txt variant="jp">きょうのごはん</Txt>
          </View>
          <Button small kind="soft" title="+ Add" onPress={() => log()} />
        </Row>
        {meals.length === 0 ? (
          <Card style={{ alignItems: 'center', gap: 8 }}>
            <Mascot size={56} mood="sleepy" />
            <Txt variant="body" soft style={{ textAlign: 'center' }}>
              Nothing logged {isToday ? 'yet today' : 'on this day'}. Snap your first bite! 📸
            </Txt>
          </Card>
        ) : (
          meals.map((m) => <MealCard key={m.id} meal={m} onPress={() => router.push(`/meal/${m.id}`)} />)
        )}
      </View>
    </Screen>
  );
}
