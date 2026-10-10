import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, View } from 'react-native';
import { Mascot } from '@/components/Mascot';
import { RecommendationCard } from '@/components/RecommendationCard';
import { Button, Card, Divider, Row, Screen, Txt } from '@/components/ui';
import { formatDayLabel, formatTime } from '@/lib/dates';
import { deleteMeal, getMeal } from '@/lib/db';
import { deletePhoto } from '@/lib/image';
import { SLOT_META } from '@/lib/mealSlot';
import { itemMacros, itemsTotals, round } from '@/lib/nutrition';
import type { Meal } from '@/lib/types';
import { useAppStore } from '@/store/useAppStore';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';

export default function MealDetail() {
  const { c } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const version = useAppStore((s) => s.dataVersion);
  const { setDraft, bumpData } = useAppStore();
  const [meal, setMeal] = useState<Meal | null | undefined>(undefined);

  useFocusEffect(
    useCallback(() => {
      getMeal(id).then(setMeal);
    }, [id, version]),
  );

  if (meal === undefined) return <Screen edges={[]}>{null}</Screen>;
  if (meal === null) {
    return (
      <Screen edges={[]} contentStyle={{ alignItems: 'center' }}>
        <Mascot mood="dizzy" />
        <Txt variant="body">This meal no longer exists.</Txt>
      </Screen>
    );
  }

  const totals = itemsTotals(meal.items);
  const meta = SLOT_META[meal.slot];
  const eaten = new Date(meal.eatenAt);

  const edit = () => {
    setDraft({
      id: meal.id,
      createdAt: meal.createdAt,
      date: meal.date,
      slot: meal.slot,
      eatenAt: meal.eatenAt,
      photoUri: meal.photoUri,
      note: meal.note,
      dishSummary: meal.dishSummary,
      items: meal.items.map((i) => ({ ...i })),
      recommendation: meal.recommendation,
      modelUsed: meal.modelUsed,
      recommendationBasisKcal: totals.kcal,
    });
    router.push('/review');
  };

  const remove = () =>
    Alert.alert('Delete this meal?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteMeal(meal.id);
          deletePhoto(meal.photoUri);
          bumpData();
          router.back();
        },
      },
    ]);

  return (
    <Screen edges={[]}>
      <Stack.Screen options={{ title: `${meta.emoji} ${meta.label}` }} />
      {meal.photoUri ? (
        <Image source={{ uri: meal.photoUri }} style={{ width: '100%', aspectRatio: 1.2, borderRadius: radius.lg }} contentFit="cover" />
      ) : null}

      <View>
        <Txt variant="caption">
          {formatDayLabel(meal.date)} · {formatTime(eaten)} · {meta.jp}
        </Txt>
        <Txt variant="title">{meal.dishSummary || 'Meal'}</Txt>
      </View>

      <Card style={{ gap: 4 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt variant="display">
            {Math.round(totals.kcal)}
            <Txt variant="h2"> kcal</Txt>
          </Txt>
          <View style={{ alignItems: 'flex-end' }}>
            <Txt variant="caption">P {round(totals.proteinG)}g</Txt>
            <Txt variant="caption">C {round(totals.carbsG)}g</Txt>
            <Txt variant="caption">F {round(totals.fatG)}g</Txt>
          </View>
        </Row>
        <Divider />
        {meal.items.map((it) => {
          const m = itemMacros(it);
          return (
            <Row key={it.id} style={{ justifyContent: 'space-between', paddingVertical: 4 }}>
              <View style={{ flex: 1 }}>
                <Txt variant="bodyBold">{it.name}</Txt>
                <Txt variant="caption">
                  {round(it.quantity, 2)} {it.unit}
                  {it.portion ? ` · ${it.portion}` : ''}
                </Txt>
              </View>
              <Txt variant="bodyBold">{Math.round(m.kcal)}</Txt>
            </Row>
          );
        })}
      </Card>

      {meal.note ? (
        <Card tint={c.yuzuSoft} style={{ borderColor: c.yuzuSoft }}>
          <Txt variant="caption">Note · メモ</Txt>
          <Txt variant="body">{meal.note}</Txt>
        </Card>
      ) : null}

      {meal.recommendation ? <RecommendationCard rec={meal.recommendation} /> : null}

      <Button title="Edit meal" icon={<Ionicons name="create-outline" size={18} color={c.onAccent} />} onPress={edit} />
      <Button title="Delete" kind="danger" onPress={remove} />
    </Screen>
  );
}
