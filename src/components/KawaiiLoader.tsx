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

export const LOCAL_LINES = [
  'Thinking on your phone… 📱',
  'No internet needed ✨',
  'Looking it up in the food table… 📖',
  'Counting rotis carefully… 🫓',
  'Almost there, tiny brain working… 🍙',
];

export function KawaiiLoader({ lines = LINES, hint }: { lines?: string[]; hint?: string }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % lines.length), 2200);
    return () => clearInterval(t);
  }, [lines]);
  return (
    <View style={{ alignItems: 'center', gap: 16, paddingVertical: 32 }}>
      <Mascot size={96} mood="yum" bounce />
      <Txt variant="h2">{lines[i % lines.length]}</Txt>
      <Txt variant="jp">しょうしょうお待ちください</Txt>
      {hint ? <Txt variant="caption">{hint}</Txt> : null}
    </View>
  );
}
