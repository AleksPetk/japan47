import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, FormScreen, Hero, Input, Notice } from '@/components/core';
import { useAuth } from '@/context/auth-context';
import { colors, spacing } from '@/constants/theme';
import { ApiError, firstFieldError } from '@/lib/api';

export default function LoginScreen() {
  const { next } = useLocalSearchParams<{ next?: string }>();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [unverified, setUnverified] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async () => { setBusy(true); setError(''); setUnverified(false); try { await login(username, password); router.replace(next && next.startsWith('/') ? next as any : '/(tabs)/profile'); } catch (requestError) { setError(firstFieldError(requestError)); setUnverified(requestError instanceof ApiError && requestError.code === 'EMAIL_NOT_VERIFIED'); } finally { setBusy(false); } };
  return <FormScreen>
    <Hero eyebrow="Welcome back" title="Sign in to Japan47" subtitle="Use the same account as the Japan47 website." />
    {error ? <Notice tone="danger">{error}</Notice> : null}
    <View style={styles.form}><Input value={username} onChangeText={setUsername} placeholder="Username" autoCapitalize="none" autoCorrect={false} textContentType="username" /><Input value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry textContentType="password" onSubmitEditing={submit} /><Button label={busy ? 'Signing in…' : 'Sign in'} disabled={busy || !username || !password} onPress={submit} />
      {unverified ? <Pressable onPress={() => router.push('/auth/check-email')}><Text style={styles.link}>Resend verification email</Text></Pressable> : null}
      <Pressable onPress={() => router.push('/auth/forgot-password')}><Text style={styles.link}>Forgot your password?</Text></Pressable>
      <View style={styles.row}><Text style={styles.muted}>New to Japan47?</Text><Pressable onPress={() => router.replace('/auth/register')}><Text style={styles.link}>Create an account</Text></Pressable></View>
    </View>
  </FormScreen>;
}

const styles = StyleSheet.create({ form: { gap: spacing.md }, row: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm }, link: { color: colors.redDark, fontWeight: '800', textAlign: 'center', paddingVertical: spacing.sm }, muted: { color: colors.muted, paddingVertical: spacing.sm } });
