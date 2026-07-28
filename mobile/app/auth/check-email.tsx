import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, FormScreen, Hero, Input, Notice } from '@/components/core';
import { colors, spacing } from '@/constants/theme';
import { api, firstFieldError, jsonBody } from '@/lib/api';

export default function CheckEmailScreen() {
  const params = useLocalSearchParams<{ email?: string; maskedEmail?: string }>();
  const [email, setEmail] = useState(params.email || '');
  const [message, setMessage] = useState(params.maskedEmail ? `We sent a verification link to ${params.maskedEmail}.` : '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const resend = async () => { setBusy(true); setError(''); try { const result = await api<{ message: string }>('/auth/resend-verification/', { method: 'POST', body: jsonBody({ email }), authenticated: false }); setMessage(result.message); } catch (requestError) { setError(firstFieldError(requestError, 'email')); } finally { setBusy(false); } };
  return <FormScreen><Hero eyebrow="One more step" title="Check your email" subtitle="Open the confirmation link to activate your Japan47 account." />{message ? <Notice tone="success">{message}</Notice> : null}{error ? <Notice tone="danger">{error}</Notice> : null}<View style={styles.form}><Text style={styles.copy}>Didn’t receive it? Enter your email to safely request another link.</Text><Input value={email} onChangeText={setEmail} placeholder="Email address" keyboardType="email-address" autoCapitalize="none" /><Button label={busy ? 'Sending…' : 'Resend verification'} disabled={busy || !email} onPress={resend} /><Button label="Return to sign in" variant="ghost" onPress={() => router.replace('/auth/login')} /></View></FormScreen>;
}
const styles = StyleSheet.create({ form: { gap: spacing.md }, copy: { color: colors.muted, lineHeight: 22 } });
