import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeProvider';
import { Txt } from './ui';

export function CalorieRing({ consumed, target, size = 168 }: { consumed: number; target: number; size?: number }) {
  const { c } = useTheme();
  const stroke = 14;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const ratio = consumed / Math.max(1, target);
  const over = ratio > 1;
  const main = Math.min(1, ratio);
  const overflow = over ? Math.min(1, ratio - 1) : 0;
  const left = Math.round(target - consumed);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.ringTrack} strokeWidth={stroke} fill="none" />
        {main > 0 && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={over ? c.yuzu : c.sakura}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circ * main} ${circ}`}
          />
        )}
        {overflow > 0 && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={c.danger}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circ * overflow} ${circ}`}
          />
        )}
      </Svg>
      <Txt variant="display" style={{ fontSize: 32 }}>
        {Math.abs(left).toLocaleString()}
      </Txt>
      <Txt variant="caption">{left >= 0 ? 'kcal left' : 'kcal over'}</Txt>
      <Txt variant="jp" faint>
        {left >= 0 ? 'のこり' : 'オーバー'}
      </Txt>
    </View>
  );
}
