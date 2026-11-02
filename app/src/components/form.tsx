// Piezas de formulario compartidas: hoja con título, campo de texto, selector de fecha y hora, selector de opciones.
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { createElement, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View, type KeyboardTypeOptions } from 'react-native';

import { Icon, Segmented, T } from '@/components/ui';
import { MaxWidth, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Contenedor de una hoja modal (formSheet): título + "Cerrar" + contenido con scroll */
export function SheetScreen({ title, children, onClose }: { title: string; children: ReactNode; onClose?: () => void }) {
  const t = useTheme();
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: Space.l, gap: Space.l, width: '100%', maxWidth: MaxWidth, alignSelf: 'center', paddingBottom: 48 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
          <T v="title" style={{ flex: 1 }}>{title}</T>
          <Pressable onPress={onClose ?? (() => router.back())} hitSlop={10} accessibilityLabel="Cerrar" style={{ minWidth: 44, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' }}>
            <Text style={{ color: t.tint, fontSize: 17, fontWeight: '600' }}>Cerrar</Text>
          </Pressable>
        </View>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Fila de formulario con etiqueta arriba y campo de texto. Úsala dentro de <Group>. */
export function TextField({ label, value, onChangeText, placeholder, multiline, keyboardType, secure, autoCapitalize }: {
  label: string; value: string; onChangeText: (s: string) => void; placeholder?: string; multiline?: boolean; keyboardType?: KeyboardTypeOptions; secure?: boolean; autoCapitalize?: 'none' | 'sentences' | 'words';
}) {
  const t = useTheme();
  return (
    <View style={{ paddingHorizontal: Space.l, paddingVertical: 10, gap: 2, backgroundColor: t.surface }}>
      <T v="caption" dim>{label}</T>
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={t.label3} multiline={multiline} keyboardType={keyboardType} secureTextEntry={secure} autoCapitalize={autoCapitalize}
        accessibilityLabel={label} style={{ color: t.label, fontSize: 17, minHeight: multiline ? 72 : 28, paddingVertical: 2, textAlignVertical: multiline ? 'top' : 'center' }} />
    </View>
  );
}

/** Fecha y hora. value en milisegundos (epoch), igual que el backend. */
export function DateTimeField({ label, value, onChange }: { label: string; value: number; onChange: (ms: number) => void }) {
  const t = useTheme();
  const body = Platform.OS === 'web'
    ? createElement('input', {
        type: 'datetime-local',
        value: new Date(value - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16),
        onChange: (e: { target: { value: string } }) => { const ms = new Date(e.target.value).getTime(); if (ms > 0) onChange(ms); },
        style: { font: 'inherit', fontSize: 17, border: 0, background: 'transparent', color: t.label, padding: 0, colorScheme: t.bg === '#000000' ? 'dark' : 'light' },
      })
    : <DateTimePicker value={new Date(value)} mode="datetime" display="compact" locale="es-MX" onChange={(_, d) => d && onChange(d.getTime())} />;
  return (
    <View style={{ paddingHorizontal: Space.l, paddingVertical: 10, gap: 4, backgroundColor: t.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 56 }}>
      <T v="body">{label}</T>
      {body}
    </View>
  );
}

/** Selector de una opción: ≤3 opciones usa control segmentado, más opciones usa lista con palomita. */
export function Choice<K extends string>({ label, options, value, onChange }: { label?: string; options: readonly (readonly [K, string])[]; value: K; onChange: (k: K) => void }) {
  const t = useTheme();
  if (options.length <= 3) {
    return <View style={{ padding: Space.m, gap: 6, backgroundColor: t.surface }}>{label ? <T v="caption" dim style={{ marginLeft: 4 }}>{label}</T> : null}<Segmented options={options} value={value} onChange={onChange} /></View>;
  }
  return (
    <View style={{ backgroundColor: t.surface }}>
      {label ? <T v="caption" dim style={{ paddingHorizontal: Space.l, paddingTop: 10 }}>{label}</T> : null}
      {options.map(([k, l]) => (
        <Pressable key={k} onPress={() => onChange(k)} style={({ pressed }) => ({ minHeight: 48, paddingHorizontal: Space.l, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: pressed ? t.fill : 'transparent' })}>
          <T v="body">{l}</T>{k === value ? <Icon sf="checkmark" ion="checkmark" size={20} /> : null}
        </Pressable>
      ))}
    </View>
  );
}

/** Solo fecha (p. ej. nacimiento). value 'AAAA-MM-DD' o ''. */
export function DateField({ label, value, onChange }: { label: string; value: string; onChange: (iso: string) => void }) {
  const t = useTheme();
  const d = value ? new Date(value + 'T12:00') : new Date(2008, 0, 1);
  const body = Platform.OS === 'web'
    ? createElement('input', { type: 'date', value, max: new Date().toISOString().slice(0, 10), onChange: (e: { target: { value: string } }) => onChange(e.target.value), style: { font: 'inherit', fontSize: 17, border: 0, background: 'transparent', color: t.label, padding: 0, colorScheme: t.bg === '#000000' ? 'dark' : 'light' } })
    : <DateTimePicker value={d} mode="date" display="compact" locale="es-MX" maximumDate={new Date()} onChange={(_, x) => x && onChange(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`)} />;
  return (
    <View style={{ paddingHorizontal: Space.l, paddingVertical: 10, backgroundColor: t.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 56 }}>
      <T v="body">{label}</T>
      {body}
    </View>
  );
}
