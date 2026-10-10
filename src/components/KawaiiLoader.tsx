import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Mascot } from './Mascot';
import { Txt } from './ui';

const LINES = [
  'Peeking at your plate… 👀',
  'Counting grains of rice… 🍚',
  'Asking the bento spirits… ✨',
  'Weighing it with my eyes… ⚖️',
  'Planning your next meal… 🍙',
];

export function KawaiiLoader() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % LINES.length), 2200);
    return () => clearInterval(t);
  }, []);
  return (
    <View style={{ alignItems: 'center', gap: 16, paddingVertical: 32 }}>
      <Mascot size={96} mood="yum" bounce />
      <Txt variant="h2">{LINES[i]}</Txt>
      <Txt variant="jp">しょうしょうお待ちください</Txt>
    </View>
  );
}
