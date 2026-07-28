import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Field, FormScreen, Hero, Input, Notice } from '@/components/core';
import { useAuth } from '@/context/auth-context';
import { colors, radius, spacing } from '@/constants/theme';
import { ApiError, firstFieldError } from '@/lib/api';
import { publicOrigin } from '@/lib/config';
import type { FieldErrors } from '@/types/api';

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const { register } = useAuth();
  const [values, setValues] = useState({ username: '', email: '', password: '', password2: '', legal_consent: false });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [general, setGeneral] = useState('');
  const [busy, setBusy] = useState(false);
  const change = (name: keyof typeof values, value: string | boolean) => setValues((current) => ({ ...current, [name]: value }));
  const submit = async () => { setBusy(true); setErrors({}); setGeneral(''); try { const result = await register(values); router.replace({ pathname: '/auth/check-email', params: { email: values.email, maskedEmail: result.masked_email } }); } catch (requestError) { if (requestError instanceof ApiError) setErrors(requestError.fields); setGeneral(firstFieldError(requestError)); } finally { setBusy(false); } };
  return <FormScreen>
    <Hero eyebrow="Join the journey" title="Create your account" subtitle="Save places, track visits, contribute destinations, and join the community." />
    {general ? <Notice tone="danger">{general}</Notice> : null}
    <View style={[styles.form, Platform.OS === 'android' && { paddingBottom: insets.bottom + spacing.xxl * 2 }]}>
      <Field label="Username" error={errors.username}><Input value={values.username} onChangeText={(value) => change('username', value)} autoCapitalize="none" autoCorrect={false} /></Field>
      <Field label="Email" error={errors.email}><Input value={values.email} onChangeText={(value) => change('email', value)} autoCapitalize="none" keyboardType="email-address" textContentType="emailAddress" /></Field>
      <Field label="Password" error={errors.password}><Input value={values.password} onChangeText={(value) => change('password', value)} secureTextEntry textContentType="newPassword" /></Field>
      <Field label="Confirm password" error={errors.password2}><Input value={values.password2} onChangeText={(value) => change('password2', value)} secureTextEntry textContentType="newPassword" /></Field>
      <Field label="Legal agreement" error={errors.legal_consent}>
        <Pressable style={styles.consent} onPress={() => change('legal_consent', !values.legal_consent)} accessibilityRole="checkbox" accessibilityState={{ checked: values.legal_consent }}><View style={[styles.checkbox, values.legal_consent && styles.checkboxChecked]}>{values.legal_consent ? <Text style={styles.check}>✓</Text> : null}</View><Text style={styles.consentText}>I agree to the <Text style={styles.inlineLink} onPress={() => Linking.openURL(`${publicOrigin}/terms`)}>Terms of Use</Text> and <Text style={styles.inlineLink} onPress={() => Linking.openURL(`${publicOrigin}/privacy`)}>Privacy Policy</Text>.</Text></Pressable>
      </Field>
      <Button label={busy ? 'Creating account…' : 'Create account'} disabled={busy || !values.legal_consent} onPress={submit} />
      <Pressable onPress={() => router.replace('/auth/login')}><Text style={styles.link}>Already registered? Sign in</Text></Pressable>
    </View>
  </FormScreen>;
}

const styles = StyleSheet.create({
  form: { gap: spacing.md }, consent: { minHeight: 54, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, padding: spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surface },
  checkbox: { width: 24, height: 24, borderWidth: 2, borderColor: colors.line, borderRadius: 5, alignItems: 'center', justifyContent: 'center' }, checkboxChecked: { borderColor: colors.red, backgroundColor: colors.red }, check: { color: colors.surface, fontWeight: '900' }, consentText: { flex: 1, color: colors.muted, lineHeight: 21 }, inlineLink: { color: colors.redDark, fontWeight: '800', textDecorationLine: 'underline' }, link: { color: colors.redDark, fontWeight: '800', textAlign: 'center', padding: spacing.sm },
});
