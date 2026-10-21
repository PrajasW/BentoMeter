import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Switch, View } from 'react-native';
import { ApiKeyForm } from '@/components/ApiKeyForm';
import { LocalAiCard } from '@/components/LocalAiCard';
import { MessSettingsCard } from '@/components/MessSettingsCard';
import { Mascot } from '@/components/Mascot';
import { Button, Card, Chip, Input, Row, Screen, Segmented, success, Txt } from '@/components/ui';
import { exportBackup, importBackup } from '@/lib/backup';
import { MODEL_CHOICES } from '@/lib/gemini';
import { GOAL_META, targetsFor } from '@/lib/nutrition';
import type { ThemePref } from '@/lib/types';
import { useAppStore } from '@/store/useAppStore';
import { useTheme } from '@/theme/ThemeProvider';

export default function Settings() {
  const { c } = useTheme();
  const s = useAppStore();
  const profile = s.profile!;
  const targets = targetsFor(profile);
  const [editingKey, setEditingKey] = useState(!s.apiKey);
  const [customModel, setCustomModel] = useState(
    MODEL_CHOICES.some((m) => m.id === s.modelId) ? '' : s.modelId,
  );

  const runExport = async () => {
    try {
      const n = await exportBackup();
      success();
      Alert.alert('Exported', `${n} meals saved to the backup file.`);
    } catch (e) {
      Alert.alert('Export failed', String(e));
    }
  };

  const runImport = async () => {
    try {
      const n = await importBackup();
      if (n == null) return;
      await s.hydrate();
      s.bumpData();
      success();
      Alert.alert('Imported', `${n} meals restored.`);
    } catch (e) {
      Alert.alert('Import failed', e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Screen>
      <View>
        <Txt variant="jp">せってい</Txt>
        <Txt variant="title">Settings</Txt>
      </View>

      <Card style={{ gap: 12 }}>
        <Txt variant="h2">Theme</Txt>
        <Segmented<ThemePref>
          value={s.themePref}
          onChange={s.setThemePref}
          options={[
            { value: 'light', label: '☀️ Washi' },
            { value: 'dark', label: '🌙 Yoru' },
            { value: 'system', label: 'Auto' },
          ]}
        />
      </Card>

      <Pressable onPress={() => router.push('/profile')}>
        <Card style={{ gap: 6 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt variant="h2">Profile & goal</Txt>
            <Ionicons name="chevron-forward" size={18} color={c.textFaint} />
          </Row>
          <Txt variant="body" soft>
            {profile.age} y · {profile.heightCm} cm · {profile.weightKg} kg · {GOAL_META[profile.goal].label}
          </Txt>
          <Txt variant="bodyBold" color={c.sakura}>
            {targets.kcal.toLocaleString()} kcal/day{profile.targetOverride != null ? ' (custom)' : ''}
          </Txt>
        </Card>
      </Pressable>

      <Card style={{ gap: 12 }}>
        <Txt variant="h2">Gemini</Txt>
        {editingKey ? (
          <ApiKeyForm
            initial={s.apiKey}
            onSave={async (k) => {
              await s.setApiKey(k);
              success();
              setEditingKey(false);
            }}
          />
        ) : (
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt variant="body" soft>
              API key ••••{s.apiKey?.slice(-4)}
            </Txt>
            <Row>
              <Button small kind="soft" title="Change" onPress={() => setEditingKey(true)} />
              <Button
                small
                kind="ghost"
                title="Remove"
                onPress={() =>
                  Alert.alert('Remove API key?', undefined, [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Remove',
                      style: 'destructive',
                      onPress: async () => {
                        await s.setApiKey('');
                        setEditingKey(true);
                      },
                    },
                  ])
                }
              />
            </Row>
          </Row>
        )}

        <Txt variant="caption">Model</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {MODEL_CHOICES.map((m) => (
            <Chip
              key={m.id}
              label={m.label}
              selected={s.modelId === m.id}
              onPress={() => {
                setCustomModel('');
                s.setModelId(m.id);
              }}
            />
          ))}
        </View>
        <Input
          value={customModel}
          onChangeText={setCustomModel}
          onSubmitEditing={() => customModel.trim() && s.setModelId(customModel.trim())}
          onBlur={() => customModel.trim() && s.setModelId(customModel.trim())}
          placeholder="…or type any model id"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Txt variant="bodyBold">Fall back to Flash</Txt>
            <Txt variant="caption">If Pro is out of quota or busy, use a Flash model instead of failing.</Txt>
          </View>
          <Switch
            value={s.useFallback}
            onValueChange={s.setUseFallback}
            trackColor={{ true: c.sakura, false: c.border }}
            thumbColor="#fff"
          />
        </Row>
      </Card>

      <LocalAiCard />

      <MessSettingsCard />

      <Card style={{ gap: 12 }}>
        <Txt variant="h2">Backup</Txt>
        <Txt variant="caption">Your data lives only on this phone. Export a JSON backup now and then (photos not included).</Txt>
        <Row>
          <Button small kind="soft" title="Export" onPress={runExport} style={{ flex: 1 }} />
          <Button small kind="soft" title="Import" onPress={runImport} style={{ flex: 1 }} />
        </Row>
      </Card>

      <View style={{ alignItems: 'center', gap: 6, paddingTop: 8 }}>
        <Mascot size={48} mood="wink" />
        <Txt variant="caption" faint>
          BentoMeter v{Constants.expoConfig?.version ?? '?'} · いただきます!
        </Txt>
      </View>
    </Screen>
  );
}
