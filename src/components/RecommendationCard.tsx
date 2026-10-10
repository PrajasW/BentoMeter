import { View } from 'react-native';
import { SLOT_META } from '@/lib/mealSlot';
import type { Recommendation } from '@/lib/types';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';
import { Button, Card, Row, Txt } from './ui';

export function RecommendationCard({
  rec,
  onRefresh,
  refreshing,
  stale,
}: {
  rec: Recommendation;
  onRefresh?: () => void;
  refreshing?: boolean;
  stale?: boolean;
}) {
  const { c } = useTheme();
  const meta = SLOT_META[rec.nextMeal];
  return (
    <Card tint={c.matchaSoft} style={{ gap: 12, borderColor: c.matchaSoft }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <View>
          <Txt variant="caption">Next up · つぎは</Txt>
          <Txt variant="h2">
            {meta.emoji} {meta.label}
            {rec.suggestedTime ? ` around ${rec.suggestedTime}` : ''}
          </Txt>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Txt variant="number">{rec.kcalBudget}</Txt>
          <Txt variant="caption">kcal budget</Txt>
        </View>
      </Row>
      <View style={{ gap: 8 }}>
        {rec.ideas.map((idea, i) => (
          <View key={i} style={{ backgroundColor: c.card, borderRadius: radius.sm, padding: 12, gap: 2 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt variant="bodyBold" style={{ flex: 1 }}>
                {idea.name}
              </Txt>
              <Txt variant="caption">{idea.kcal} kcal</Txt>
            </Row>
            {idea.why ? <Txt variant="caption">{idea.why}</Txt> : null}
          </View>
        ))}
      </View>
      {rec.tip ? <Txt variant="body" style={{ fontStyle: 'italic' }}>{rec.tip}</Txt> : null}
      {stale && onRefresh ? (
        <Button
          small
          kind="soft"
          title={refreshing ? 'Thinking…' : '↻ Refresh suggestion'}
          loading={refreshing}
          onPress={onRefresh}
          style={{ backgroundColor: c.card, alignSelf: 'flex-start' }}
        />
      ) : null}
    </Card>
  );
}
