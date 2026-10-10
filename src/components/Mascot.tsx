import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeProvider';

export type Mood = 'happy' | 'yum' | 'dizzy' | 'sleepy' | 'wink';

/** Onigiri-kun: a tiny rice-ball mascot whose face follows your day. */
export function Mascot({ size = 64, mood = 'happy', bounce = false }: { size?: number; mood?: Mood; bounce?: boolean }) {
  const { c, isDark } = useTheme();
  const y = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!bounce) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(y, { toValue: -size * 0.12, duration: 380, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(y, { toValue: 0, duration: 380, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bounce, size, y]);

  const ink = '#3A3335';
  const rice = isDark ? '#FBF6EF' : '#FFFFFF';

  return (
    <Animated.View style={{ transform: [{ translateY: y }] }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Ellipse cx="50" cy="96" rx="30" ry="3.5" fill={c.shadow} />
        <Path
          d="M50 8 C56 8 60 12 64 18 L90 70 C95 80 90 92 78 92 L22 92 C10 92 5 80 10 70 L36 18 C40 12 44 8 50 8 Z"
          fill={rice}
          stroke={ink}
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
        <Rect x="35" y="66" width="30" height="26" rx="3" fill="#2F3B35" />
        <Rect x="35" y="66" width="30" height="3" rx="1.5" fill="#4A5A50" />
        <Ellipse cx="32" cy="57" rx="5" ry="3" fill={c.sakura} opacity={0.55} />
        <Ellipse cx="68" cy="57" rx="5" ry="3" fill={c.sakura} opacity={0.55} />
        <Face mood={mood} ink={ink} pink={c.sakura} />
      </Svg>
    </Animated.View>
  );
}

function Face({ mood, ink, pink }: { mood: Mood; ink: string; pink: string }) {
  const stroke = { stroke: ink, strokeWidth: 2.6, strokeLinecap: 'round' as const, fill: 'none' };
  switch (mood) {
    case 'happy':
      return (
        <G>
          <Path d="M36 50 Q40 45 44 50" {...stroke} />
          <Path d="M56 50 Q60 45 64 50" {...stroke} />
          <Path d="M46 56 Q50 60 54 56" {...stroke} />
        </G>
      );
    case 'yum':
      return (
        <G>
          <Circle cx="40" cy="49" r="3" fill={ink} />
          <Circle cx="60" cy="49" r="3" fill={ink} />
          <Circle cx="41" cy="48" r="1" fill="#fff" />
          <Circle cx="61" cy="48" r="1" fill="#fff" />
          <Path d="M45 55 Q50 62 55 55 Z" fill={ink} />
          <Ellipse cx="51.5" cy="58.5" rx="2.4" ry="1.6" fill={pink} />
        </G>
      );
    case 'dizzy':
      return (
        <G>
          <Path d="M37 46 L43 52 M43 46 L37 52" {...stroke} />
          <Path d="M57 46 L63 52 M63 46 L57 52" {...stroke} />
          <Path d="M44 58 Q47 55 50 58 Q53 61 56 58" {...stroke} />
        </G>
      );
    case 'sleepy':
      return (
        <G>
          <Path d="M36 50 L44 50" {...stroke} />
          <Path d="M56 50 L64 50" {...stroke} />
          <Circle cx="50" cy="57" r="2.2" {...stroke} />
        </G>
      );
    case 'wink':
      return (
        <G>
          <Path d="M36 50 Q40 45 44 50" {...stroke} />
          <Circle cx="60" cy="49" r="3" fill={ink} />
          <Path d="M46 56 Q50 60 54 56" {...stroke} />
        </G>
      );
  }
}

/** Mood from how much of the day's target has been eaten. */
export function moodFor(consumed: number, target: number): Mood {
  if (consumed === 0) return 'sleepy';
  const ratio = consumed / Math.max(1, target);
  if (ratio > 1.05) return 'dizzy';
  if (ratio > 0.85) return 'yum';
  return 'happy';
}
