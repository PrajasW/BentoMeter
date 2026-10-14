import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radius, space } from '@/theme/tokens';

export function tap() {
  if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
}

export function success() {
  if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

// ---------- text ----------

type Variant = 'display' | 'title' | 'h2' | 'body' | 'bodyBold' | 'caption' | 'jp' | 'number';

const variantStyle: Record<Variant, TextStyle> = {
  display: { fontFamily: fonts.heavy, fontSize: 34, lineHeight: 42 },
  title: { fontFamily: fonts.heavy, fontSize: 24, lineHeight: 32 },
  h2: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 24 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  bodyBold: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 17 },
  jp: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 15, letterSpacing: 1 },
  number: { fontFamily: fonts.heavy, fontSize: 20, lineHeight: 26 },
};

export function Txt({
  variant = 'body',
  soft,
  faint,
  color,
  style,
  ...rest
}: TextProps & { variant?: Variant; soft?: boolean; faint?: boolean; color?: string }) {
  const { c } = useTheme();
  const tint = color ?? (faint ? c.textFaint : soft || variant === 'jp' || variant === 'caption' ? c.textSoft : c.text);
  return <Text {...rest} style={[variantStyle[variant], { color: tint }, style]} />;
}

/** English label with a small Japanese subtitle under it. */
export function Label({ en, jp, size = 'h2' }: { en: string; jp?: string; size?: 'h2' | 'title' }) {
  return (
    <View>
      <Txt variant={size}>{en}</Txt>
      {jp ? <Txt variant="jp">{jp}</Txt> : null}
    </View>
  );
}

// ---------- layout ----------

export function Screen({
  children,
  scroll = true,
  edges = ['top'],
  contentStyle,
}: {
  children: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: c.bg }}>
      {/* Android draws edge-to-edge, so the window no longer resizes for the keyboard: shrink the
          screen ourselves so the ScrollView keeps the focused input visible above it. */}
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={[styles.screenContent, contentStyle]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.screenContent, { flex: 1 }, contentStyle]}>{children}</View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Card({ children, style, tint }: { children: ReactNode; style?: StyleProp<ViewStyle>; tint?: string }) {
  const { c } = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: tint ?? c.card, borderColor: c.border, shadowColor: c.shadow },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Row({ children, style, gap = space.sm }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

// ---------- controls ----------

export function Button({
  title,
  onPress,
  kind = 'primary',
  icon,
  disabled,
  loading,
  style,
  small,
}: {
  title: string;
  onPress?: () => void;
  kind?: 'primary' | 'soft' | 'ghost' | 'danger';
  icon?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
}) {
  const { c } = useTheme();
  const bg = { primary: c.sakura, soft: c.sakuraSoft, ghost: 'transparent', danger: 'transparent' }[kind];
  const fg = { primary: c.onAccent, soft: c.text, ghost: c.textSoft, danger: c.danger }[kind];
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress?.();
      }}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        kind === 'danger' && { borderWidth: 1.5, borderColor: c.danger },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon}
      <Txt variant="bodyBold" color={fg} style={small ? { fontSize: 13 } : undefined}>
        {title}
      </Txt>
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  color,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  color?: string;
}) {
  const { c } = useTheme();
  const accent = color ?? c.sakura;
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress?.();
      }}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? accent : c.card,
          borderColor: selected ? accent : c.border,
        },
      ]}
    >
      <Txt variant="caption" color={selected ? c.onAccent : c.textSoft} style={{ fontFamily: fonts.bold }}>
        {label}
      </Txt>
    </Pressable>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { c } = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: c.bgSoft }]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              tap();
              onChange(o.value);
            }}
            style={[styles.segment, active && { backgroundColor: c.card, shadowColor: c.shadow }, active && styles.segmentActive]}
          >
            <Txt variant="caption" color={active ? c.text : c.textSoft} style={{ fontFamily: fonts.bold }}>
              {o.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Input({ style, ...rest }: TextInputProps) {
  const { c } = useTheme();
  return (
    <TextInput
      placeholderTextColor={c.textFaint}
      {...rest}
      style={[
        styles.input,
        { backgroundColor: c.bgSoft, color: c.text, borderColor: c.border },
        rest.multiline && { minHeight: 80, textAlignVertical: 'top' },
        style,
      ]}
    />
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ gap: 6, flex: 1 }}>
      <Txt variant="caption">{label}</Txt>
      {children}
    </View>
  );
}

export function Divider() {
  const { c } = useTheme();
  return <View style={{ height: 1, backgroundColor: c.border, marginVertical: space.sm }} />;
}

const styles = StyleSheet.create({
  screenContent: { padding: space.lg, paddingBottom: 120, gap: space.lg },
  card: {
    borderRadius: radius.lg,
    padding: space.lg,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 2,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    minHeight: 52,
    paddingHorizontal: space.xl,
    borderRadius: radius.pill,
  },
  buttonSmall: { minHeight: 38, paddingHorizontal: space.lg },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  segmented: { flexDirection: 'row', borderRadius: radius.pill, padding: 4 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: radius.pill },
  segmentActive: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6, elevation: 1 },
  input: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: space.lg,
    paddingVertical: 12,
    fontFamily: fonts.medium,
    fontSize: 15,
  },
});
