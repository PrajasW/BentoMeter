import { useMemo, useState } from 'react';
import { Pressable, Switch, View } from 'react-native';
import { ACTIVITY_META, calculatedTarget, GOAL_META, targetsFor } from '@/lib/nutrition';
import type { Activity, Goal, Profile, Sex } from '@/lib/types';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';
import { Button, Card, Field, Input, Row, Segmented, tap, Txt } from './ui';

const ACTIVITIES = Object.keys(ACTIVITY_META) as Activity[];

export function ProfileForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial: Profile | null;
  submitLabel: string;
  onSubmit: (p: Profile) => void;
}) {
  const { c } = useTheme();
  const [name, setName] = useState(initial?.name ?? '');
  const [age, setAge] = useState(String(initial?.age ?? ''));
  const [sex, setSex] = useState<Sex>(initial?.sex ?? 'female');
  const [height, setHeight] = useState(String(initial?.heightCm ?? ''));
  const [weight, setWeight] = useState(String(initial?.weightKg ?? ''));
  const [activity, setActivity] = useState<Activity>(initial?.activity ?? 'light');
  const [goal, setGoal] = useState<Goal>(initial?.goal ?? 'maintain');
  const [useOverride, setUseOverride] = useState(initial?.targetOverride != null);
  const [override, setOverride] = useState(String(initial?.targetOverride ?? ''));

  const profile = useMemo<Profile | null>(() => {
    const a = Number(age);
    const h = Number(height);
    const w = Number(weight);
    if (!(a >= 10 && a <= 110 && h >= 100 && h <= 250 && w >= 25 && w <= 350)) return null;
    const o = Number(override);
    return {
      name: name.trim(),
      age: a,
      sex,
      heightCm: h,
      weightKg: w,
      activity,
      goal,
      targetOverride: useOverride && o >= 800 && o <= 6000 ? Math.round(o) : null,
    };
  }, [name, age, sex, height, weight, activity, goal, useOverride, override]);

  const targets = profile ? targetsFor(profile) : null;

  return (
    <View style={{ gap: 16 }}>
      <Field label="Nickname (optional)">
        <Input value={name} onChangeText={setName} placeholder="e.g. Mochi" />
      </Field>
      <Row gap={12}>
        <Field label="Age">
          <Input value={age} onChangeText={setAge} keyboardType="number-pad" placeholder="24" />
        </Field>
        <Field label="Height (cm)">
          <Input value={height} onChangeText={setHeight} keyboardType="decimal-pad" placeholder="170" />
        </Field>
        <Field label="Weight (kg)">
          <Input value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="65" />
        </Field>
      </Row>
      <Field label="Sex (for the BMR formula)">
        <Segmented<Sex>
          value={sex}
          onChange={setSex}
          options={[
            { value: 'female', label: 'Female' },
            { value: 'male', label: 'Male' },
            { value: 'other', label: 'Other' },
          ]}
        />
      </Field>
      <Field label="Activity">
        <View style={{ gap: 6 }}>
          {ACTIVITIES.map((a) => {
            const active = a === activity;
            return (
              <Pressable
                key={a}
                onPress={() => {
                  tap();
                  setActivity(a);
                }}
                style={{
                  borderRadius: radius.md,
                  borderWidth: 1.5,
                  borderColor: active ? c.sakura : c.border,
                  backgroundColor: active ? c.sakuraSoft : c.card,
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                }}
              >
                <Txt variant="bodyBold">{ACTIVITY_META[a].label}</Txt>
                <Txt variant="caption">{ACTIVITY_META[a].hint}</Txt>
              </Pressable>
            );
          })}
        </View>
      </Field>
      <Field label="Goal">
        <Segmented<Goal>
          value={goal}
          onChange={setGoal}
          options={(Object.keys(GOAL_META) as Goal[]).map((g) => ({ value: g, label: GOAL_META[g].label }))}
        />
      </Field>

      <Card tint={c.sakuraSoft} style={{ gap: 8, borderColor: c.sakuraSoft }}>
        <Txt variant="caption">Your daily target · もくひょう</Txt>
        {targets && profile ? (
          <>
            <Txt variant="display">
              {targets.kcal.toLocaleString()}
              <Txt variant="h2"> kcal</Txt>
            </Txt>
            <Txt variant="caption">
              P {targets.proteinG}g · C {targets.carbsG}g · F {targets.fatG}g
              {profile.targetOverride != null ? `  (calculated: ${calculatedTarget(profile)})` : ''}
            </Txt>
          </>
        ) : (
          <Txt variant="body" soft>
            Fill in age, height and weight to see it ✨
          </Txt>
        )}
        <Row style={{ justifyContent: 'space-between', marginTop: 4 }}>
          <Txt variant="caption">Set my own number</Txt>
          <Switch
            value={useOverride}
            onValueChange={setUseOverride}
            trackColor={{ true: c.sakura, false: c.border }}
            thumbColor="#fff"
          />
        </Row>
        {useOverride ? (
          <Input
            value={override}
            onChangeText={setOverride}
            keyboardType="number-pad"
            placeholder="e.g. 1900"
            style={{ backgroundColor: c.card }}
          />
        ) : null}
      </Card>

      <Button title={submitLabel} disabled={!profile} onPress={() => profile && onSubmit(profile)} />
    </View>
  );
}
