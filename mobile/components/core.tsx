import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { PropsWithChildren, ReactNode, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable,
  RefreshControl, ScrollView, StyleProp, StyleSheet, Text, TextInput,
  TextInputProps, View, ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, shadow, spacing, typography } from '@/constants/theme';
import { apiMediaUrl } from '@/lib/config';
import type { FieldErrors } from '@/types/api';

export function Screen({ children, refreshing = false, onRefresh, contentStyle }: PropsWithChildren<{
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
}>) {
  return <SafeAreaView style={styles.safe} edges={['left', 'right']}>
    <ScrollView
      contentContainerStyle={[styles.screen, contentStyle]}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.red} /> : undefined}
    >{children}</ScrollView>
  </SafeAreaView>;
}

export function FormScreen({ children }: PropsWithChildren) {
  return <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <Screen>{children}</Screen>
  </KeyboardAvoidingView>;
}

export function Eyebrow({ children, light = false }: PropsWithChildren<{ light?: boolean }>) {
  return <Text style={[styles.eyebrow, light && styles.eyebrowLight]}>{children}</Text>;
}

export function Hero({ eyebrow, title, subtitle, children }: PropsWithChildren<{ eyebrow: string; title: string; subtitle?: string }>) {
  return <View style={styles.hero}>
    <View style={styles.heroDecoration} />
    <Eyebrow>{eyebrow}</Eyebrow>
    <Text style={styles.heroTitle}>{title}</Text>
    {subtitle ? <Text style={styles.heroSubtitle}>{subtitle}</Text> : null}
    {children ? <View style={styles.heroActions}>{children}</View> : null}
  </View>;
}

export function Section({ title, eyebrow, action, children }: PropsWithChildren<{ title: string; eyebrow?: string; action?: ReactNode }>) {
  return <View style={styles.section}>
    <View style={styles.sectionHeader}><View style={styles.sectionHeading}>{eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}<Text style={styles.sectionTitle}>{title}</Text></View>{action}</View>
    {children}
  </View>;
}

export function Button({ label, onPress, variant = 'primary', icon, disabled = false, compact = false }: {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  compact?: boolean;
}) {
  return <Pressable
    accessibilityRole="button"
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [styles.button, styles[`button_${variant}`], compact && styles.buttonCompact, (pressed || disabled) && styles.buttonDim]}
  >{icon ? <Ionicons name={icon} size={18} color={variant === 'secondary' || variant === 'ghost' ? colors.ink : colors.surface} /> : null}<Text style={[styles.buttonText, (variant === 'secondary' || variant === 'ghost') && styles.buttonTextDark]}>{label}</Text></Pressable>;
}

export function Field({ label, error, hint, children }: PropsWithChildren<{ label: string; error?: string | string[]; hint?: string }>) {
  const message = Array.isArray(error) ? error[0] : error;
  return <View style={styles.field}><Text style={styles.label}>{label}</Text>{children}{hint ? <Text style={styles.hint}>{hint}</Text> : null}{message ? <Text style={styles.fieldError}>{message}</Text> : null}</View>;
}

export function Input(props: TextInputProps) {
  return <TextInput placeholderTextColor="#92988F" {...props} style={[styles.input, props.multiline && styles.textarea, props.style]} />;
}

export function ChoiceField({ label, value, options, onChange, error, placeholder = 'Choose…' }: {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (value: string) => void;
  error?: string | string[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);
  return <Field label={label} error={error}>
    <Pressable style={styles.choice} onPress={() => setOpen(true)}><Text style={selected ? styles.choiceText : styles.choicePlaceholder}>{selected?.label || placeholder}</Text><Ionicons name="chevron-down" size={18} color={colors.muted} /></Pressable>
    <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
      <Pressable style={styles.modalBackdrop} onPress={() => setOpen(false)}>
        <Pressable style={styles.choiceSheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.sheetHandle} /><Text style={styles.sheetTitle}>{label}</Text>
          <ScrollView>{options.map((option) => <Pressable key={option.value} style={styles.choiceOption} onPress={() => { onChange(option.value); setOpen(false); }}><Text style={[styles.choiceText, option.value === value && styles.choiceActive]}>{option.label}</Text>{option.value === value ? <Ionicons name="checkmark" size={20} color={colors.red} /> : null}</Pressable>)}</ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  </Field>;
}

export function ImagePickerField({ label, asset, onChange, multiple = false, selectionLimit = 5, error, hint }: {
  label: string;
  asset?: ImagePicker.ImagePickerAsset | ImagePicker.ImagePickerAsset[] | null;
  onChange: (value: ImagePicker.ImagePickerAsset | ImagePicker.ImagePickerAsset[] | null) => void;
  multiple?: boolean;
  selectionLimit?: number;
  error?: string | string[];
  hint?: string;
}) {
  const pick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, allowsMultipleSelection: multiple, selectionLimit: multiple ? selectionLimit : 1 });
    if (!result.canceled) onChange(multiple ? result.assets : result.assets[0]);
  };
  const count = Array.isArray(asset) ? asset.length : asset ? 1 : 0;
  return <Field label={label} error={error} hint={count ? `${count} image${count === 1 ? '' : 's'} selected` : hint || 'JPEG, PNG, WebP, HEIC, or HEIF.'}>
    <Button label={count ? 'Choose different image' : 'Choose from photos'} variant="secondary" icon="image-outline" onPress={pick} />
  </Field>;
}

export function RemoteImage({ uri, style, placeholder = '旅', contentFit = 'cover' }: {
  uri?: string | null;
  style?: StyleProp<ViewStyle>;
  placeholder?: string;
  contentFit?: 'cover' | 'contain';
}) {
  const source = apiMediaUrl(uri);
  return source
    ? <Image source={{ uri: source }} style={style as any} contentFit={contentFit} transition={180} />
    : <View style={[styles.imagePlaceholder, style]}><Text style={styles.imageMark}>{placeholder}</Text></View>;
}

export function Rating({ value, count, large = false }: { value?: number | null; count?: number; large?: boolean }) {
  return <View style={styles.rating}><Text style={[styles.star, large && styles.starLarge]}>★</Text><Text style={[styles.ratingValue, large && styles.ratingLarge]}>{value ? Number(value).toFixed(1) : 'New'}</Text>{typeof count === 'number' ? <Text style={styles.ratingCount}>({count})</Text> : null}</View>;
}

export function Loading({ label = 'Loading Japan47…' }: { label?: string }) {
  return <View style={styles.state}><ActivityIndicator color={colors.red} size="large" /><Text style={styles.stateText}>{label}</Text></View>;
}

export function Empty({ title = 'Nothing here yet', message }: { title?: string; message?: string }) {
  return <View style={styles.state}><Text style={styles.stateMark}>旅</Text><Text style={styles.stateTitle}>{title}</Text>{message ? <Text style={styles.stateText}>{message}</Text> : null}</View>;
}

export function ErrorState({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return <View style={styles.state}><Ionicons name="alert-circle-outline" size={38} color={colors.red} /><Text style={styles.stateTitle}>Something went wrong</Text><Text style={styles.stateText}>{error.message}</Text>{onRetry ? <Button label="Try again" variant="secondary" onPress={onRetry} /> : null}</View>;
}

export function Notice({ children, tone = 'info' }: PropsWithChildren<{ tone?: 'info' | 'success' | 'warning' | 'danger' }>) {
  return <View style={[styles.notice, styles[`notice_${tone}`]]}><Text style={styles.noticeText}>{children}</Text></View>;
}

export function Avatar({ uri, name, size = 52 }: { uri?: string | null; name: string; size?: number }) {
  return uri ? <RemoteImage uri={uri} style={{ width: size, height: size, borderRadius: size / 2 }} /> : <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}><Text style={[styles.avatarText, { fontSize: size * 0.4 }]}>{name.slice(0, 1).toUpperCase()}</Text></View>;
}

export function StatGrid({ items }: { items: { value: string | number; label: string }[] }) {
  return <View style={styles.stats}>{items.map((item) => <View key={item.label} style={styles.stat}><Text style={styles.statValue}>{item.value}</Text><Text style={styles.statLabel}>{item.label}</Text></View>)}</View>;
}

export function errorFor(errors: FieldErrors, name: string) {
  return errors[name];
}

export function confirm(title: string, message: string) {
  return new Promise<boolean>((resolve) => Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
    { text: 'Continue', style: 'destructive', onPress: () => resolve(true) },
  ], { cancelable: true, onDismiss: () => resolve(false) }));
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  screen: { padding: spacing.lg, paddingBottom: 48, gap: spacing.xl },
  hero: { position: 'relative', overflow: 'hidden', backgroundColor: '#F8F1EE', borderColor: '#EADED8', borderWidth: 1, borderRadius: radius.lg, padding: spacing.xl, minHeight: 154, justifyContent: 'center' },
  heroDecoration: { position: 'absolute', width: 190, height: 190, borderRadius: 95, borderWidth: 1, borderColor: '#E3C7C2', backgroundColor: '#F3E2DE', right: -55, top: -45, opacity: 0.7 },
  heroTitle: { color: colors.ink, fontFamily: typography.title, fontSize: 32, lineHeight: 37, fontWeight: '700', letterSpacing: -1 },
  heroSubtitle: { color: colors.muted, marginTop: spacing.sm, fontSize: 15, lineHeight: 22, maxWidth: '88%' },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
  eyebrow: { color: colors.red, fontSize: 11, lineHeight: 16, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: spacing.xs },
  eyebrowLight: { color: '#E9A79F' },
  section: { gap: spacing.md },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: spacing.md },
  sectionHeading: { flex: 1 },
  sectionTitle: { color: colors.ink, fontFamily: typography.title, fontWeight: '700', fontSize: 25, lineHeight: 30 },
  button: { minHeight: 48, borderRadius: radius.md, paddingHorizontal: 18, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.red, borderWidth: 1, borderColor: colors.red },
  button_primary: {},
  button_secondary: { backgroundColor: colors.surface, borderColor: colors.line },
  button_ghost: { backgroundColor: 'transparent', borderColor: 'transparent' },
  button_danger: { backgroundColor: colors.danger, borderColor: colors.danger },
  buttonCompact: { minHeight: 40, paddingVertical: 8, paddingHorizontal: 12 },
  buttonDim: { opacity: 0.55 },
  buttonText: { color: colors.surface, fontWeight: '800', fontSize: 14 },
  buttonTextDark: { color: colors.ink },
  field: { gap: 6 },
  label: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  fieldError: { color: colors.danger, fontSize: 12, fontWeight: '600' },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: 11, color: colors.ink, fontSize: 16 },
  textarea: { minHeight: 110, textAlignVertical: 'top' },
  choice: { minHeight: 48, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  choiceText: { color: colors.ink, fontSize: 16 },
  choicePlaceholder: { color: '#92988F', fontSize: 16 },
  choiceActive: { color: colors.red, fontWeight: '700' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(20,25,20,.38)' },
  choiceSheet: { maxHeight: '70%', backgroundColor: colors.paper, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: 36 },
  sheetHandle: { width: 42, height: 5, borderRadius: 3, alignSelf: 'center', backgroundColor: colors.line, marginBottom: spacing.md },
  sheetTitle: { fontFamily: typography.title, color: colors.ink, fontSize: 22, fontWeight: '700', marginBottom: spacing.md },
  choiceOption: { minHeight: 50, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  imagePlaceholder: { backgroundColor: colors.sage, alignItems: 'center', justifyContent: 'center' },
  imageMark: { color: '#7D8D78', fontSize: 40, fontFamily: typography.title },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  star: { color: colors.gold, fontSize: 16 },
  starLarge: { fontSize: 22 },
  ratingValue: { color: colors.ink, fontWeight: '800', fontSize: 13 },
  ratingLarge: { fontSize: 18 },
  ratingCount: { color: colors.muted, fontSize: 12 },
  state: { minHeight: 210, padding: spacing.xl, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  stateMark: { color: '#D8A7A1', fontFamily: typography.title, fontSize: 44 },
  stateTitle: { color: colors.ink, fontFamily: typography.title, fontWeight: '700', fontSize: 21, textAlign: 'center' },
  stateText: { color: colors.muted, lineHeight: 21, textAlign: 'center' },
  notice: { borderLeftWidth: 4, padding: spacing.md, borderRadius: radius.sm, backgroundColor: '#EEF2EA' },
  notice_info: { borderLeftColor: colors.blue },
  notice_success: { borderLeftColor: colors.success },
  notice_warning: { borderLeftColor: colors.warning },
  notice_danger: { borderLeftColor: colors.danger },
  noticeText: { color: colors.ink, lineHeight: 20 },
  avatar: { backgroundColor: colors.sage, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.forest, fontFamily: typography.title, fontWeight: '700' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface, ...shadow },
  stat: { flex: 1, minWidth: 92, alignItems: 'center', padding: spacing.md, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: colors.line },
  statValue: { color: colors.red, fontFamily: typography.title, fontWeight: '700', fontSize: 23 },
  statLabel: { color: colors.muted, fontSize: 11, textAlign: 'center', marginTop: 2 },
});
