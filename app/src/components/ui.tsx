// Componentes base con estética iOS: listas agrupadas, botones, segmented control, badges, estados vacíos.
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { Children, Fragment, isValidElement, type ComponentRef, type ReactNode, type RefObject } from 'react';
import {
  ActivityIndicator, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View,
  type StyleProp, type TextProps, type TextStyle, type ViewStyle,
} from 'react-native';

import { MaxWidth, Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export const tap = () => { if (Platform.OS !== 'web') void Haptics.selectionAsync().catch(() => {}); };
export const impact = () => { if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); };

/** Icono: SF Symbol en iPhone, Ionicons en Android y web */
export function Icon({ sf, ion, size = 22, color }: { sf: string; ion: keyof typeof Ionicons.glyphMap; size?: number; color?: string }) {
  const t = useTheme();
  const c = color ?? t.tint;
  if (Platform.OS === 'ios') return <SymbolView name={sf as never} size={size} tintColor={c} resizeMode="scaleAspectFit" style={{ width: size, height: size }} />;
  return <Ionicons name={ion} size={size} color={c} />;
}

type Variant = 'title' | 'large' | 'headline' | 'body' | 'sub' | 'caption' | 'num';
const TEXT: Record<Variant, TextStyle> = {
  large: { fontSize: 28, fontWeight: '700', letterSpacing: 0.3 },
  title: { fontSize: 22, fontWeight: '700', letterSpacing: 0.2 },
  headline: { fontSize: 17, fontWeight: '600' },
  body: { fontSize: 17 },
  sub: { fontSize: 15 },
  caption: { fontSize: 13 },
  num: { fontSize: 28, fontWeight: '700', fontVariant: ['tabular-nums'] },
};
export function T({ v = 'body', dim, color, style, ...p }: TextProps & { v?: Variant; dim?: boolean; color?: string }) {
  const t = useTheme();
  return <Text {...p} style={[{ color: color ?? (dim ? t.label2 : t.label) }, TEXT[v], style]} />;
}

/** Pantalla con scroll y título grande nativo (lo pone el Stack). En web centra el contenido. */
export function Screen({ children, onRefresh, refreshing, gap = Space.l, scrollRef }: { children: ReactNode; onRefresh?: () => void; refreshing?: boolean; gap?: number; scrollRef?: RefObject<ComponentRef<typeof ScrollView> | null> }) {
  const t = useTheme();
  return (
    <ScrollView
      ref={scrollRef}
      style={{ backgroundColor: t.bg }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[styles.screen, { gap }]}
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={t.label2} /> : undefined}>
      {children}
    </ScrollView>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const t = useTheme();
  const base = [{ backgroundColor: t.surface, borderRadius: Radius.m, padding: Space.l, gap: Space.s }, style];
  return onPress ? <Pressable onPress={onPress} style={({ pressed }) => [...base, pressed && { opacity: 0.7 }]}>{children}</Pressable> : <View style={base}>{children}</View>;
}

/** Lista agrupada inset (como Ajustes de iOS) */
export function Group({ children, header, footer }: { children: ReactNode; header?: string; footer?: string }) {
  const t = useTheme();
  const items = Children.toArray(children).filter(Boolean);
  return (
    <View style={{ gap: 6 }}>
      {header ? <T v="caption" dim style={styles.groupHead}>{header}</T> : null}
      <View style={{ backgroundColor: t.surface, borderRadius: Radius.m, overflow: 'hidden' }}>
        {items.map((c, i) => (
          <Fragment key={isValidElement(c) && c.key != null ? c.key : i}>
            {i > 0 ? <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.sep, marginLeft: Space.l }} /> : null}
            {c}
          </Fragment>
        ))}
      </View>
      {footer ? <T v="caption" dim style={styles.groupHead}>{footer}</T> : null}
    </View>
  );
}

export function Row({ leading, title, subtitle, trailing, onPress, chevron, tone, minHeight = 56 }: {
  leading?: ReactNode; title: ReactNode; subtitle?: ReactNode; trailing?: ReactNode; onPress?: () => void; chevron?: boolean; tone?: 'danger'; minHeight?: number;
}) {
  const t = useTheme();
  const body = (
    <View style={[styles.row, { minHeight }]}>
      {leading}
      <View style={{ flex: 1, gap: 2 }}>
        {typeof title === 'string' ? <T v="headline" color={tone === 'danger' ? t.bad : undefined} style={{ fontWeight: '500' }} numberOfLines={2}>{title}</T> : title}
        {typeof subtitle === 'string' ? <T v="caption" dim numberOfLines={2}>{subtitle}</T> : subtitle}
      </View>
      {trailing}
      {chevron ? <Icon sf="chevron.right" ion="chevron-forward" size={14} color={t.label3} /> : null}
    </View>
  );
  if (!onPress) return body;
  return <Pressable onPress={() => { tap(); onPress(); }} style={({ pressed }) => pressed && { backgroundColor: t.fill }}>{body}</Pressable>;
}

type Tone = 'neutral' | 'ok' | 'warn' | 'bad' | 'gold' | 'tint';
export function Badge({ text, tone = 'neutral' }: { text: string; tone?: Tone }) {
  const t = useTheme();
  const m: Record<Tone, [string, string]> = {
    neutral: [t.fill, t.label2], ok: [t.okWeak, t.ok], warn: [t.warnWeak, t.warn], bad: [t.badWeak, t.bad], gold: ['rgba(242,194,48,0.28)', t.warn], tint: [t.tintWeak, t.tint],
  };
  return (
    <View style={{ backgroundColor: m[tone][0], paddingHorizontal: 9, paddingVertical: 3, borderRadius: Radius.pill, alignSelf: 'flex-start' }}>
      <Text style={{ color: m[tone][1], fontSize: 12, fontWeight: '600' }}>{text}</Text>
    </View>
  );
}

export function Button({ title, onPress, kind = 'filled', loading, disabled, small, icon }: {
  title: string; onPress: () => void | Promise<void>; kind?: 'filled' | 'tinted' | 'gold' | 'danger' | 'plain'; loading?: boolean; disabled?: boolean; small?: boolean; icon?: ReactNode;
}) {
  const t = useTheme();
  const bg = { filled: t.tint, tinted: t.tintWeak, gold: t.gold, danger: t.badWeak, plain: 'transparent' }[kind];
  const fg = { filled: t.bg === '#000000' ? '#071647' : '#FFFFFF', tinted: t.tint, gold: t.onGold, danger: t.bad, plain: t.tint }[kind];
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={() => { impact(); void onPress(); }}
      style={({ pressed }) => [styles.btn, { backgroundColor: bg, minHeight: small ? 44 : 50, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 }, pressed && { transform: [{ scale: 0.985 }] }]}>
      {loading ? <ActivityIndicator color={fg} /> : <>{icon}<Text style={{ color: fg, fontSize: small ? 15 : 17, fontWeight: '600' }}>{title}</Text></>}
    </Pressable>
  );
}

export function Segmented<K extends string>({ options, value, onChange }: { options: readonly (readonly [K, string])[]; value: K; onChange: (k: K) => void }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: t.fill, borderRadius: 10, padding: 2 }} accessibilityRole="tablist">
      {options.map(([k, l]) => {
        const on = k === value;
        return (
          <Pressable key={k} onPress={() => { tap(); onChange(k); }} accessibilityRole="tab" accessibilityState={{ selected: on }}
            style={[{ flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 8 }, on && { backgroundColor: t.surface, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 }]}>
            <Text style={{ color: t.label, fontSize: 14, fontWeight: on ? '600' : '500' }}>{l}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Avatar({ name, size = 42 }: { name: string; size?: number }) {
  const t = useTheme();
  const ini = name.split(/\s+/).slice(0, 2).map((s) => s[0]).join('').toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: t.hero, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(242,194,48,0.6)' }}>
      <Text style={{ color: t.gold, fontWeight: '700', fontSize: size * 0.34 }}>{ini}</Text>
    </View>
  );
}

export function Empty({ sf = 'tray', ion = 'file-tray-outline', title, text }: { sf?: string; ion?: keyof typeof Ionicons.glyphMap; title: string; text?: string }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: 8, paddingVertical: Space.xxl, paddingHorizontal: Space.xl }}>
      <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: t.tintWeak, alignItems: 'center', justifyContent: 'center' }}>
        <Icon sf={sf} ion={ion} size={26} />
      </View>
      <T v="headline">{title}</T>
      {text ? <T v="sub" dim style={{ textAlign: 'center' }}>{text}</T> : null}
    </View>
  );
}

export function Loading() {
  const t = useTheme();
  return <View style={{ padding: Space.xxl, alignItems: 'center' }}><ActivityIndicator color={t.label2} /></View>;
}

export function Title({ children }: { children: ReactNode }) {
  return <T v="title" style={{ marginTop: Space.s }}>{children}</T>;
}

const styles = StyleSheet.create({
  screen: { padding: Space.l, paddingBottom: Platform.OS === 'web' ? 110 : 48, width: '100%', maxWidth: MaxWidth, alignSelf: 'center' },
  groupHead: { marginLeft: Space.l, textTransform: 'uppercase', letterSpacing: 0.3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Space.m, paddingHorizontal: Space.l, paddingVertical: Space.m },
  btn: { borderRadius: Radius.m, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
});
