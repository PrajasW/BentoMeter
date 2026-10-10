import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { FoodItemRow } from '@/components/FoodItemRow';
import { RecommendationCard } from '@/components/RecommendationCard';
import { WhenPicker } from '@/components/WhenPicker';
import { Button, Card, Input, Row, Screen, success, Txt } from '@/components/ui';
import { buildDayContext } from '@/lib/dayContext';
import { dayKey, newId } from '@/lib/dates';
import { deleteMeal, saveMeal } from '@/lib/db';
import { refreshRecommendation } from '@/lib/gemini';
import { deletePhoto } from '@/lib/image';
import { isStale, itemsTotals, round } from '@/lib/nutrition';
import type { FoodItem, Meal } from '@/lib/types';
import { useAppStore } from '@/store/useAppStore';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';

const blankItem = (): FoodItem => ({
  id: newId(),
  name: '',
  portion: '',
  quantity: 1,
  unit: 'serving',
  kcalPerUnit: 0,
  proteinPerUnit: 0,
  carbsPerUnit: 0,
  fatPerUnit: 0,
  confidence: null,
});

export default function Review() {
  const { c } = useTheme();
  const { draft, updateDraft, setDraft, bumpData, setSelectedDate, profile, apiKey, modelId, useFallback } = useAppStore();
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  if (!draft) {
    return (
      <Screen edges={[]}>
        <Txt variant="body" soft>
          Nothing to review.
        </Txt>
        <Button title="Back" onPress={() => router.back()} />
      </Screen>
    );
  }

  const editing = draft.id != null;
  const totals = itemsTotals(draft.items);
  const when = new Date(draft.eatenAt);
  const stale = draft.recommendation != null && isStale(draft.recommendationBasisKcal, totals.kcal);

  const setItem = (i: number, item: FoodItem) => {
    const items = [...draft.items];
    items[i] = item;
    updateDraft({ items });
  };

  const save = async () => {
    setSaving(true);
    const now = new Date().toISOString();
    const meal: Meal = {
      id: draft.id ?? newId(),
      date: dayKey(when),
      slot: draft.slot,
      eatenAt: draft.eatenAt,
      photoUri: draft.photoUri,
      note: draft.note,
      dishSummary: draft.dishSummary.trim() || draft.items.map((i) => i.name).filter(Boolean).join(', ') || 'Meal',
      recommendation: draft.recommendation,
      modelUsed: draft.modelUsed,
      items: draft.items.filter((i) => i.name.trim() || i.kcalPerUnit > 0),
      createdAt: draft.createdAt ?? now,
      updatedAt: now,
    };
    try {
      await saveMeal(meal);
      success();
      bumpData();
      setSelectedDate(meal.date);
      setDraft(null);
      if (editing) router.back();
      else router.dismissTo('/');
    } catch (e) {
      Alert.alert('Could not save', String(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = () => {
    Alert.alert('Delete this meal?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteMeal(draft.id!);
          deletePhoto(draft.photoUri);
          bumpData();
          setDraft(null);
          router.dismissAll();
        },
      },
    ]);
  };

  const refresh = async () => {
    if (!profile || !apiKey) return;
    setRefreshing(true);
    try {
      const context = await buildDayContext({
        profile,
        date: dayKey(when),
        slot: draft.slot,
        eatenAt: when,
        excludeMealId: draft.id,
      });
      const rec = await refreshRecommendation({
        apiKey,
        model: modelId,
        useFallback,
        context,
        thisMeal: { summary: draft.dishSummary || draft.items.map((i) => i.name).join(', '), totals },
      });
      if (rec) updateDraft({ recommendation: rec, recommendationBasisKcal: totals.kcal });
    } catch (e) {
      Alert.alert('Could not refresh', e instanceof Error ? e.message : String(e));
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Screen edges={[]}>
      <Stack.Screen options={{ title: editing ? 'Edit meal' : 'Review' }} />

      {draft.photoUri ? (
        <Image source={{ uri: draft.photoUri }} style={{ width: '100%', height: 200, borderRadius: radius.lg }} contentFit="cover" />
      ) : null}

      <Input
        value={draft.dishSummary}
        onChangeText={(dishSummary) => updateDraft({ dishSummary })}
        placeholder="Meal name"
        style={{ fontSize: 18 }}
      />

      <WhenPicker
        slot={draft.slot}
        onSlot={(slot) => updateDraft({ slot })}
        when={when}
        onWhen={(d) => updateDraft({ eatenAt: d.toISOString(), date: dayKey(d) })}
      />

      <Card tint={c.sakuraSoft} style={{ borderColor: c.sakuraSoft }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View>
            <Txt variant="caption">This meal · ごうけい</Txt>
            <Txt variant="display">
              {Math.round(totals.kcal)}
              <Txt variant="h2"> kcal</Txt>
            </Txt>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 2 }}>
            <Txt variant="caption">Protein {round(totals.proteinG)} g</Txt>
            <Txt variant="caption">Carbs {round(totals.carbsG)} g</Txt>
            <Txt variant="caption">Fat {round(totals.fatG)} g</Txt>
          </View>
        </Row>
      </Card>

      <View style={{ gap: 10 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View>
            <Txt variant="h2">Items</Txt>
            <Txt variant="jp">なかみ · tap numbers to edit</Txt>
          </View>
          <Button
            small
            kind="soft"
            title="Add item"
            icon={<Ionicons name="add" size={16} color={c.text} />}
            onPress={() => updateDraft({ items: [...draft.items, blankItem()] })}
          />
        </Row>
        {draft.items.length === 0 ? (
          <Txt variant="body" soft>
            No items yet — add what you ate with “Add item”.
          </Txt>
        ) : (
          draft.items.map((item, i) => (
            <FoodItemRow
              key={item.id}
              item={item}
              onChange={(next) => setItem(i, next)}
              onRemove={() => updateDraft({ items: draft.items.filter((_, j) => j !== i) })}
            />
          ))
        )}
      </View>

      <Input
        value={draft.note}
        onChangeText={(note) => updateDraft({ note })}
        placeholder="Personal note (optional)"
      />

      {draft.recommendation ? (
        <RecommendationCard rec={draft.recommendation} stale={stale} refreshing={refreshing} onRefresh={refresh} />
      ) : null}

      {draft.modelUsed ? (
        <Txt variant="caption" faint style={{ textAlign: 'center' }}>
          Estimated by {draft.modelUsed} · values are approximate
        </Txt>
      ) : null}

      <Button title={editing ? 'Save changes' : 'Save meal 🍱'} onPress={save} loading={saving} />
      {editing ? <Button title="Delete meal" kind="danger" onPress={remove} /> : null}
    </Screen>
  );
}
