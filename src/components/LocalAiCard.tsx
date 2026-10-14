import { Ionicons } from '@expo/vector-icons';
import { Alert, Switch, View } from 'react-native';
import { Button, Card, Label, Row, Txt } from '@/components/ui';
import { isLocalRuntimeAvailable } from '@/lib/local/llm';
import { LOCAL_MODEL, LOCAL_MODEL_BYTES } from '@/lib/local/models';
import { useAppStore } from '@/store/useAppStore';
import { useTheme } from '@/theme/ThemeProvider';

const SIZE_GB = (LOCAL_MODEL_BYTES / 1e9).toFixed(1);

/** Settings card: download / delete the on-device model and choose it as the default engine. */
export function LocalAiCard() {
  const { c } = useTheme();
  const { localModel, engine, setEngine, downloadLocalModel, cancelLocalDownload, deleteLocalModel } = useAppStore();
  const runtime = isLocalRuntimeAvailable();

  const confirmDownload = () =>
    Alert.alert(
      'Download on-device AI?',
      `${LOCAL_MODEL.label} is about ${SIZE_GB} GB. Use Wi‑Fi — keep the app open until it finishes.`,
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Download', onPress: () => void downloadLocalModel() },
      ],
    );

  const confirmDelete = () =>
    Alert.alert('Delete the on-device model?', `This frees about ${SIZE_GB} GB. You can download it again later.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void deleteLocalModel() },
    ]);

  return (
    <Card style={{ gap: 12 }}>
      <Label en="On-device AI" jp="ローカル" />
      <Txt variant="caption">
        Works offline and never hits a rate limit. It names the foods, and calories come from a built-in Indian food table (INDB).
        Slower than Gemini — a photo takes around half a minute.
      </Txt>

      {!runtime ? (
        <Txt variant="caption" color={c.danger}>
          Needs the development build of the app — it can’t run inside Expo Go.
        </Txt>
      ) : null}

      {localModel.state === 'downloading' ? (
        <View style={{ gap: 8 }}>
          <View style={{ height: 10, borderRadius: 999, backgroundColor: c.sakuraSoft, overflow: 'hidden' }}>
            <View style={{ width: `${Math.round(localModel.progress * 100)}%`, height: '100%', backgroundColor: c.sakura, borderRadius: 999 }} />
          </View>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt variant="caption">
              Downloading… {Math.round(localModel.progress * 100)}% of {SIZE_GB} GB
            </Txt>
            <Button small kind="ghost" title="Cancel" onPress={cancelLocalDownload} />
          </Row>
        </View>
      ) : localModel.state === 'ready' ? (
        <>
          <Row style={{ justifyContent: 'space-between' }}>
            <Row>
              <Ionicons name="checkmark-circle" size={18} color={c.matcha} />
              <Txt variant="body">{LOCAL_MODEL.label} ready</Txt>
            </Row>
            <Button small kind="ghost" title="Delete" onPress={confirmDelete} />
          </Row>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Txt variant="bodyBold">Always use on-device</Txt>
              <Txt variant="caption">Skip Gemini entirely. Off: Gemini first, on-device offered when it fails.</Txt>
            </View>
            <Switch
              value={engine === 'local'}
              onValueChange={(v) => setEngine(v ? 'local' : 'gemini')}
              trackColor={{ true: c.sakura, false: c.border }}
              thumbColor="#fff"
            />
          </Row>
        </>
      ) : (
        <>
          {localModel.state === 'error' ? (
            <Txt variant="caption" color={c.danger}>
              {localModel.message}
            </Txt>
          ) : null}
          <Button
            kind="soft"
            title={localModel.state === 'error' ? 'Retry download' : `Download (${SIZE_GB} GB)`}
            disabled={!runtime}
            onPress={confirmDownload}
            icon={<Ionicons name="cloud-download-outline" size={18} color={c.text} />}
          />
        </>
      )}
    </Card>
  );
}
