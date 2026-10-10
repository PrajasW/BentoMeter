import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { KawaiiLoader } from '@/components/KawaiiLoader';
import { Mascot } from '@/components/Mascot';
import { WhenPicker } from '@/components/WhenPicker';
import { Button, Card, Input, Screen, Segmented, Txt } from '@/components/ui';
import { buildDayContext } from '@/lib/dayContext';
import { atTime, dayKey, todayKey } from '@/lib/dates';
import { analyzeMeal, GeminiError } from '@/lib/gemini';
import { preparePhoto } from '@/lib/image';
import { defaultTimeForSlot, slotForTime, SLOTS } from '@/lib/mealSlot';
import { itemsTotals } from '@/lib/nutrition';
import type { Slot } from '@/lib/types';
import { useAppStore, type Draft } from '@/store/useAppStore';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';

type Mode = 'photo' | 'text';

export default function Capture() {
  const { c } = useTheme();
  const params = useLocalSearchParams<{ date?: string; slot?: string }>();
  const date = params.date ?? todayKey();
  const isToday = date === todayKey();
  const initialSlot: Slot = SLOTS.includes(params.slot as Slot) ? (params.slot as Slot) : slotForTime(new Date());

  const { profile, apiKey, modelId, useFallback, setDraft } = useAppStore();
  const [slot, setSlot] = useState<Slot>(initialSlot);
  const [when, setWhen] = useState<Date>(() => {
    if (isToday) return new Date();
    const t = defaultTimeForSlot(initialSlot);
    return atTime(date, t.h, t.m);
  });
  const [timeTouched, setTimeTouched] = useState(false);
  const [mode, setMode] = useState<Mode>('photo');
  const [photo, setPhoto] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changeSlot = (s: Slot) => {
    setSlot(s);
    // Back-filling another day: move the clock to a typical time for that meal.
    if (!isToday && !timeTouched) {
      const t = defaultTimeForSlot(s);
      setWhen(atTime(dayKey(when), t.h, t.m));
    }
  };

  const pick = async (source: 'camera' | 'library') => {
    setError(null);
    if (source === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Camera needed', 'Allow camera access in settings to snap your meals.');
        return;
      }
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.85 };
    const res =
      source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (!res.canceled && res.assets?.[0]) setPhoto(res.assets[0].uri);
  };

  const baseDraft = (savedUri: string | null): Draft => ({
    id: null,
    createdAt: null,
    date: dayKey(when),
    slot,
    eatenAt: when.toISOString(),
    photoUri: savedUri,
    note: note.trim(),
    dishSummary: mode === 'text' ? description.trim() : '',
    items: [],
    recommendation: null,
    modelUsed: null,
    recommendationBasisKcal: 0,
  });

  const analyze = async () => {
    if (!profile) return;
    if (!apiKey) {
      Alert.alert('Gemini key missing', 'Add your Gemini API key in Settings first.', [
        { text: 'Later' },
        { text: 'Open Settings', onPress: () => router.replace('/settings') },
      ]);
      return;
    }
    setBusy(true);
    setError(null);
    let savedUri: string | null = null;
    try {
      let imageBase64: string | undefined;
      if (mode === 'photo' && photo) {
        const prepared = await preparePhoto(photo);
        savedUri = prepared.savedUri;
        imageBase64 = prepared.base64;
      }
      const context = await buildDayContext({
        profile,
        date: dayKey(when),
        slot,
        eatenAt: when,
        note: note.trim() || undefined,
      });
      const result = await analyzeMeal({
        apiKey,
        model: modelId,
        useFallback,
        imageBase64,
        description: mode === 'text' ? description.trim() : undefined,
        context,
      });
      setDraft({
        ...baseDraft(savedUri),
        dishSummary: result.dishSummary,
        items: result.items,
        recommendation: result.recommendation,
        modelUsed: result.modelUsed,
        recommendationBasisKcal: itemsTotals(result.items).kcal,
      });
      router.replace('/review');
    } catch (e) {
      setError(e instanceof GeminiError ? e.message : 'Something went wrong while analyzing.');
      // Keep the saved photo so "enter manually" can still use it.
      if (savedUri) setPhoto(savedUri);
    } finally {
      setBusy(false);
    }
  };

  const manual = async () => {
    let savedUri: string | null = null;
    if (mode === 'photo' && photo) {
      try {
        savedUri = (await preparePhoto(photo)).savedUri;
      } catch {
        savedUri = null;
      }
    }
    setDraft(baseDraft(savedUri));
    router.replace('/review');
  };

  if (busy) {
    return (
      <Screen edges={[]} contentStyle={{ flexGrow: 1, justifyContent: 'center' }}>
        {photo ? <Image source={{ uri: photo }} style={styles.preview} contentFit="cover" /> : null}
        <KawaiiLoader />
      </Screen>
    );
  }

  const canAnalyze = mode === 'photo' ? !!photo : description.trim().length > 2;

  return (
    <Screen edges={[]}>
      <WhenPicker
        slot={slot}
        onSlot={changeSlot}
        when={when}
        onWhen={(d) => {
          setTimeTouched(true);
          setWhen(d);
        }}
      />

      <Segmented<Mode>
        value={mode}
        onChange={setMode}
        options={[
          { value: 'photo', label: '📷 Photo' },
          { value: 'text', label: '✍️ Describe it' },
        ]}
      />

      {mode === 'photo' ? (
        photo ? (
          <View>
            <Image source={{ uri: photo }} style={styles.preview} contentFit="cover" transition={200} />
            <Pressable onPress={() => setPhoto(null)} style={[styles.clear, { backgroundColor: c.card }]}>
              <Ionicons name="close" size={18} color={c.text} />
            </Pressable>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Pressable onPress={() => pick('camera')} style={[styles.pickBox, { backgroundColor: c.sakuraSoft, borderColor: c.sakura }]}>
              <Ionicons name="camera" size={34} color={c.sakura} />
              <Txt variant="bodyBold">Take photo</Txt>
              <Txt variant="jp">さつえい</Txt>
            </Pressable>
            <Pressable onPress={() => pick('library')} style={[styles.pickBox, { backgroundColor: c.soraSoft, borderColor: c.sora }]}>
              <Ionicons name="images" size={34} color={c.sora} />
              <Txt variant="bodyBold">From gallery</Txt>
              <Txt variant="jp">アルバム</Txt>
            </Pressable>
          </View>
        )
      ) : (
        <Input
          value={description}
          onChangeText={setDescription}
          multiline
          placeholder={'e.g. 2 rotis, a bowl of dal and\na glass of buttermilk'}
        />
      )}

      <Input
        value={note}
        onChangeText={setNote}
        placeholder="Note for Gemini, e.g. ate half the rice"
      />

      {error ? (
        <Card tint={c.sakuraSoft} style={{ gap: 10, alignItems: 'center', borderColor: c.sakuraSoft }}>
          <Mascot size={56} mood="dizzy" />
          <Txt variant="bodyBold" style={{ textAlign: 'center' }}>
            {error}
          </Txt>
          <Txt variant="caption" style={{ textAlign: 'center' }}>
            You can try again, or type the foods in yourself.
          </Txt>
        </Card>
      ) : null}

      <Button
        title={error ? 'Try again' : 'Analyze'}
        disabled={!canAnalyze}
        onPress={analyze}
        icon={<Ionicons name="sparkles" size={18} color={c.onAccent} />}
      />
      <Button title="Enter items manually" kind="ghost" onPress={manual} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  preview: { width: '100%', aspectRatio: 1, borderRadius: radius.lg },
  clear: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickBox: {
    flex: 1,
    aspectRatio: 0.9,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
});
