import { useState } from 'react';
import { Alert, Linking, Switch, View } from 'react-native';
import { testDiningKey } from '@/lib/messApi';
import { useAppStore } from '@/store/useAppStore';
import { useTheme } from '@/theme/ThemeProvider';
import { Button, Card, Input, Row, success, Txt } from './ui';

/** Settings card for the IIIT-H mess menu feature and the optional dining-portal key. */
export function MessSettingsCard() {
  const { c } = useTheme();
  const { messEnabled, setMessEnabled, diningKey, setDiningKey } = useAppStore();
  const [editing, setEditing] = useState(false);
  const [key, setKey] = useState('');
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);

  const test = async (value: string) => {
    setTesting(true);
    setStatus(await testDiningKey(value));
    setTesting(false);
  };

  return (
    <Card style={{ gap: 12 }}>
      <View>
        <Txt variant="h2">IIIT-H mess 🏫</Txt>
        <Txt variant="jp">しょくどうのメニュー</Txt>
      </View>
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Txt variant="bodyBold">Use mess menus</Txt>
          <Txt variant="caption">
            When you log breakfast, lunch, snacks or dinner, the mess menu is sent as a hint so dishes get their real names.
          </Txt>
        </View>
        <Switch
          value={messEnabled}
          onValueChange={setMessEnabled}
          trackColor={{ true: c.sakura, false: c.border }}
          thumbColor="#fff"
        />
      </Row>

      {messEnabled ? (
        <>
          <Txt variant="caption">Dining portal key (optional)</Txt>
          {diningKey && !editing ? (
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt variant="body" soft>
                Key ••••{diningKey.slice(-4)}
              </Txt>
              <Row>
                <Button small kind="soft" title="Test" loading={testing} onPress={() => test(diningKey)} />
                <Button small kind="soft" title="Change" onPress={() => setEditing(true)} />
                <Button
                  small
                  kind="ghost"
                  title="Remove"
                  onPress={() =>
                    Alert.alert('Remove dining key?', undefined, [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Remove',
                        style: 'destructive',
                        onPress: async () => {
                          await setDiningKey('');
                          setStatus(null);
                        },
                      },
                    ])
                  }
                />
              </Row>
            </Row>
          ) : (
            <>
              <Input
                value={key}
                onChangeText={(t) => {
                  setKey(t);
                  setStatus(null);
                }}
                placeholder="Paste your dining.iiit.ac.in key"
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
              />
              <Row>
                <Button small kind="soft" title="Test" loading={testing} disabled={!key.trim()} onPress={() => test(key)} />
                <Button
                  small
                  title="Save key"
                  disabled={!key.trim()}
                  style={{ flex: 1 }}
                  onPress={async () => {
                    await setDiningKey(key);
                    success();
                    setKey('');
                    setEditing(false);
                  }}
                />
              </Row>
            </>
          )}
          {status ? (
            <Txt variant="caption" color={status.ok ? c.matcha : c.danger}>
              {status.ok ? '✓ ' : '✗ '}
              {status.message}
            </Txt>
          ) : null}
          <Txt variant="caption" faint>
            {"With a key, the mess picker starts on the mess you're registered at. It's stored only on this phone. Create one at "}
            <Txt variant="caption" color={c.sakura} onPress={() => Linking.openURL('https://dining.iiit.ac.in/settings')}>
              dining.iiit.ac.in/settings
            </Txt>
            .
          </Txt>
        </>
      ) : null}
    </Card>
  );
}
