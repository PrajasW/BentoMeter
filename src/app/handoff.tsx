import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useEffect, useRef, useState } from 'react';
import { Alert, AppState, Share, View } from 'react-native';
import { Mascot } from '@/components/Mascot';
import { Button, Card, Input, Label, Row, Screen, success, Txt } from '@/components/ui';
import { buildDayContext } from '@/lib/dayContext';
import { buildHandoffPrompt, HANDOFF_MODEL_LABEL, looksLikeHandoffReply, parseHandoffReply } from '@/lib/handoff';
import { itemsTotals } from '@/lib/nutrition';
import { useAppStore } from '@/store/useAppStore';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';

/** Fallback when the Gemini API is rate-limited: hand the meal to the Gemini/ChatGPT app and paste its JSON back. */
export default function Handoff() {
  const { c } = useTheme();
  const { draft, setDraft, profile } = useAppStore();
  const [copied, setCopied] = useState(false);
  const [reply, setReply] = useState('');
  const [error, setError] = useState<string | null>(null);

  const sentPrompt = useRef<string | null>(null);

  // Coming back from the chat app with the answer already copied: prefill it.
  useEffect(() => {
    if (!copied) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      Clipboard.getStringAsync()
        .then((text) => {
          if (text !== sentPrompt.current && looksLikeHandoffReply(text)) setReply((r) => r || text);
        })
        .catch(() => {});
    });
    return () => sub.remove();
  }, [copied]);

  if (!draft || !profile) {
    return (
      <Screen edges={[]}>
        <Txt variant="body" soft>
          Nothing to analyze.
        </Txt>
        <Button title="Back" onPress={() => router.back()} />
      </Screen>
    );
  }

  const hasPhoto = !!draft.photoUri;
  const description = hasPhoto ? undefined : draft.dishSummary;

  const makePrompt = async () => {
    const eatenAt = new Date(draft.eatenAt);
    const context = await buildDayContext({
      profile,
      date: draft.date,
      slot: draft.slot,
      eatenAt,
      excludeMealId: draft.id,
      note: draft.note || undefined,
      mess: draft.mess,
    });
    return buildHandoffPrompt(context, { hasPhoto, description });
  };

  const copyAndShare = async () => {
    setError(null);
    try {
      const prompt = await makePrompt();
      sentPrompt.current = prompt;
      await Clipboard.setStringAsync(prompt);
      setCopied(true);
      if (hasPhoto) {
        if (!(await Sharing.isAvailableAsync())) {
          Alert.alert('Sharing unavailable', 'The prompt is copied — attach the photo in the chat app yourself.');
          return;
        }
        await Sharing.shareAsync(draft.photoUri!, { mimeType: 'image/jpeg', dialogTitle: 'Send photo to Gemini or ChatGPT' });
      } else {
        await Share.share({ message: prompt });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const pasteFromClipboard = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) setReply(text);
  };

  const importReply = () => {
    setError(null);
    try {
      const result = parseHandoffReply(reply);
      setDraft({
        ...draft,
        dishSummary: result.dishSummary || draft.dishSummary,
        items: result.items,
        recommendation: result.recommendation,
        modelUsed: HANDOFF_MODEL_LABEL,
        recommendationBasisKcal: itemsTotals(result.items).kcal,
      });
      success();
      router.replace('/review');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Screen edges={[]}>
      <Card tint={c.soraSoft} style={{ borderColor: c.soraSoft, gap: 6 }}>
        <Txt variant="bodyBold">Gemini is busy, so let’s ask your chat app 💬</Txt>
        <Txt variant="caption">
          {hasPhoto
            ? 'The prompt goes to your clipboard and the photo opens the share sheet. Pick Gemini or ChatGPT, paste the prompt next to the photo and send.'
            : 'Pick Gemini or ChatGPT in the share sheet and send the prompt.'}
        </Txt>
      </Card>

      <Card style={{ gap: 12 }}>
        <Label en="1 · Send it" jp="おくる" />
        {hasPhoto ? (
          <Image source={{ uri: draft.photoUri! }} style={{ width: '100%', height: 160, borderRadius: radius.md }} contentFit="cover" />
        ) : (
          <Txt variant="body" soft numberOfLines={3}>
            “{description}”
          </Txt>
        )}
        <Button
          title={hasPhoto ? 'Copy prompt & share photo' : 'Share prompt'}
          kind={copied ? 'soft' : 'primary'}
          onPress={copyAndShare}
          icon={<Ionicons name="share-outline" size={18} color={copied ? c.text : c.onAccent} />}
        />
        {copied ? (
          <Row style={{ justifyContent: 'center' }}>
            <Ionicons name="checkmark-circle" size={16} color={c.matcha} />
            <Txt variant="caption">Prompt copied — paste it in the chat</Txt>
          </Row>
        ) : null}
      </Card>

      <Card style={{ gap: 12 }}>
        <Label en="2 · Paste the reply" jp="はりつけ" />
        <Txt variant="caption">Copy the whole answer (the JSON block) and paste it here.</Txt>
        <Input
          value={reply}
          onChangeText={setReply}
          multiline
          placeholder="Paste the chat reply here"
          style={{ minHeight: 120, maxHeight: 240, textAlignVertical: 'top', fontSize: 12 }}
        />
        <Button small kind="soft" title="Paste from clipboard" onPress={pasteFromClipboard} icon={<Ionicons name="clipboard-outline" size={16} color={c.text} />} />
      </Card>

      {error ? (
        <Card tint={c.sakuraSoft} style={{ gap: 10, alignItems: 'center', borderColor: c.sakuraSoft }}>
          <Mascot size={56} mood="dizzy" />
          <Txt variant="bodyBold" style={{ textAlign: 'center' }}>
            {error}
          </Txt>
        </Card>
      ) : null}

      <Button title="Import meal" disabled={reply.trim().length < 10} onPress={importReply} />
      <View style={{ alignItems: 'center' }}>
        <Button
          title="Skip — enter items manually"
          kind="ghost"
          onPress={() => router.replace('/review')}
        />
      </View>
    </Screen>
  );
}
