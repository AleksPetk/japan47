import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Field, FormScreen, Input, Notice } from '@/components/core';
import { colors, typography } from '@/constants/theme';
import { api, ApiError, firstFieldError, jsonBody } from '@/lib/api';
import type { FieldErrors } from '@/types/api';

export default function ResetPasswordScreen() {
  const { uid, token } = useLocalSearchParams<{ uid?: string; token?: string }>();
  const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({}); const [busy, setBusy] = useState(false); const [done, setDone] = useState(false);
  const submit = async () => {
    if (!uid || !token) { setErrors({ detail: 'This reset link is incomplete.' }); return; }
    if (password !== confirm) { setErrors({ password_confirm: 'Passwords do not match.' }); return; }
    setBusy(true); setErrors({});
    try { await api('/auth/password-reset/confirm/', { method: 'POST', body: jsonBody({ uid, token, new_password: password, new_password2: confirm }), authenticated: false }); setDone(true); }
    catch (error) { setErrors(error instanceof ApiError ? error.fields : { detail: firstFieldError(error) }); }
    finally { setBusy(false); }
  };
  return <FormScreen><Text style={styles.title}>Choose a new password</Text>{done ? <><Notice tone="success">Your password has been changed.</Notice><Button label="Sign in" onPress={() => router.replace('/auth/login')} /></> : <>{errors.detail ? <Notice tone="danger">{firstFieldError({ fields: errors })}</Notice> : null}<Field label="New password" error={errors.new_password}><Input secureTextEntry value={password} onChangeText={setPassword} autoCapitalize="none" /></Field><Field label="Confirm password" error={errors.password_confirm || errors.new_password2}><Input secureTextEntry value={confirm} onChangeText={setConfirm} autoCapitalize="none" /></Field><Button label={busy ? 'Changing…' : 'Change password'} disabled={busy || !password || !confirm} onPress={submit} /></>}</FormScreen>;
}
const styles = StyleSheet.create({ title: { color: colors.ink, fontFamily: typography.title, fontWeight: '700', fontSize: 30 } });
