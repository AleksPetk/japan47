import { router } from 'expo-router';
import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, FormScreen, Hero, Input, Notice } from '@/components/core';
import { spacing } from '@/constants/theme';
import { api, firstFieldError, jsonBody } from '@/lib/api';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState(''); const [message, setMessage] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async () => { setBusy(true); setError(''); try { const result = await api<{ message: string }>('/auth/password-reset/request/', { method: 'POST', body: jsonBody({ email }), authenticated: false }); setMessage(result.message); } catch (requestError) { setError(firstFieldError(requestError, 'email')); } finally { setBusy(false); } };
  return <FormScreen><Hero eyebrow="Account recovery" title="Reset your password" subtitle="We’ll email a secure reset link if an account exists." />{message ? <Notice tone="success">{message}</Notice> : null}{error ? <Notice tone="danger">{error}</Notice> : null}<View style={styles.form}><Input value={email} onChangeText={setEmail} placeholder="Email address" keyboardType="email-address" autoCapitalize="none" /><Button label={busy ? 'Sending…' : 'Send reset instructions'} disabled={busy || !email} onPress={submit} /><Button label="Back to sign in" variant="ghost" onPress={() => router.back()} /></View></FormScreen>;
}
const styles = StyleSheet.create({ form: { gap: spacing.md } });
