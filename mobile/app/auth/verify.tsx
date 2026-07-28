import { useEffect, useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, FormScreen, Loading, Notice } from '@/components/core';
import { colors, typography } from '@/constants/theme';
import { api, firstFieldError, jsonBody } from '@/lib/api';

export default function VerifyEmailScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!token) { setMessage('This verification link is incomplete.'); setState('error'); return; }
    api<{ message?: string }>('/auth/verify-email/', { method: 'POST', body: jsonBody({ token }), authenticated: false })
      .then((value) => { setMessage(value.message || 'Your email has been verified.'); setState('success'); })
      .catch((error: unknown) => { setMessage(firstFieldError(error)); setState('error'); });
  }, [token]);
  return <FormScreen><Text style={styles.title}>Email verification</Text>{state === 'loading' ? <Loading label="Verifying your email…" /> : <><Notice tone={state === 'success' ? 'success' : 'danger'}>{message}</Notice><Button label="Continue to sign in" onPress={() => router.replace('/auth/login')} /></>}</FormScreen>;
}
const styles = StyleSheet.create({ title: { color: colors.ink, fontFamily: typography.title, fontWeight: '700', fontSize: 30 } });
