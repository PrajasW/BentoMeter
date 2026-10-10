import { View } from 'react-native';
import type { Macros, Targets } from '@/lib/types';
import { useTheme } from '@/theme/ThemeProvider';
import { Txt } from './ui';

export function MacroBars({ totals, targets }: { totals: Macros; targets: Targets }) {
  const { c } = useTheme();
  const rows = [
    { label: 'Protein', jp: 'たんぱく質', value: totals.proteinG, target: targets.proteinG, color: c.matcha, track: c.matchaSoft },
    { label: 'Carbs', jp: '炭水化物', value: totals.carbsG, target: targets.carbsG, color: c.yuzu, track: c.yuzuSoft },
    { label: 'Fat', jp: '脂質', value: totals.fatG, target: targets.fatG, color: c.sora, track: c.soraSoft },
  ];
  return (
    <View style={{ gap: 12, flex: 1 }}>
      {rows.map((r) => (
        <View key={r.label} style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Txt variant="caption" style={{ color: c.text }}>
              {r.label}
            </Txt>
            <Txt variant="caption">
              {Math.round(r.value)}/{r.target}g
            </Txt>
          </View>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: r.track, overflow: 'hidden' }}>
            <View
              style={{
                width: `${Math.min(100, (r.value / Math.max(1, r.target)) * 100)}%`,
                height: '100%',
                borderRadius: 4,
                backgroundColor: r.color,
              }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}
