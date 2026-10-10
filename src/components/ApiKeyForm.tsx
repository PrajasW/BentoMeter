import { useState } from 'react';
import { Linking, View } from 'react-native';
import { testApiKey } from '@/lib/gemini';
import { useTheme } from '@/theme/ThemeProvider';
import { Button, Input, Row, Txt } from './ui';

export function ApiKeyForm({
  initial,
  onSave,
  saveLabel = 'Save key',
}: {
  initial: string | null;
  onSave: (key: string) => void;
  saveLabel?: string;
}) {
  const { c } = useTheme();
  const [key, setKey] = useState(initial ?? '');
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);

  const test = async () => {
    setTesting(true);
    setStatus(await testApiKey(key.trim()));
    setTesting(false);
  };

  return (
    <View style={{ gap: 12 }}>
      <Input
        value={key}
        onChangeText={(t) => {
          setKey(t);
          setStatus(null);
        }}
        placeholder="Paste your Gemini API key"
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
      />
      {status ? (
        <Txt variant="caption" color={status.ok ? c.matcha : c.danger}>
          {status.ok ? '✓ ' : '✗ '}
          {status.message}
        </Txt>
      ) : null}
      <Row>
        <Button title="Test" kind="soft" small onPress={test} loading={testing} disabled={!key.trim()} />
        <Button title={saveLabel} small onPress={() => onSave(key)} disabled={!key.trim()} style={{ flex: 1 }} />
      </Row>
      <Txt variant="caption" faint>
        Stored only on this device in secure storage. Get a key at{' '}
        <Txt variant="caption" color={c.sakura} onPress={() => Linking.openURL('https://aistudio.google.com/apikey')}>
          aistudio.google.com/apikey
        </Txt>
      </Txt>
    </View>
  );
}
