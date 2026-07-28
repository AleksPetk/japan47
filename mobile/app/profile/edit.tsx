import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Field, FormScreen, Hero, ImagePickerField, Input, Notice } from '@/components/core';
import { useAuth } from '@/context/auth-context';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { ApiError, api, firstFieldError, jsonBody } from '@/lib/api';
import { appendImage } from '@/lib/uploads';
import type { FieldErrors, Profile } from '@/types/api';

type DeleteStep = 'initial' | 'password' | 'final' | null;

export default function ProfileEditScreen() {
  const { user, reloadUser, clearAuth } = useAuth();
  const [nickname, setNickname] = useState(''); const [email, setEmail] = useState(''); const [image, setImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({}); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  const [deleteStep, setDeleteStep] = useState<DeleteStep>(null); const [password, setPassword] = useState(''); const [confirmation, setConfirmation] = useState(''); const [deleteError, setDeleteError] = useState(''); const [deleteBusy, setDeleteBusy] = useState(false);
  useEffect(() => { if (user) { setNickname(user.nickname || ''); setEmail(user.email || ''); } }, [user]);
  if (!user) return <FormScreen><Hero eyebrow="Account required" title="Sign in to edit your profile"><Button label="Sign in" onPress={() => router.replace('/auth/login')} /></Hero></FormScreen>;
  const save = async () => { setBusy(true); setErrors({}); setMessage(''); const form = new FormData(); form.append('nickname', nickname); form.append('email', email); if (image) appendImage(form, 'profile_image', image); try { const updated = await api<Profile>('/profile/', { method: 'PATCH', body: form }); if (!updated.email_verified) { await clearAuth(); router.replace({ pathname: '/auth/check-email', params: { email } }); return; } await reloadUser(); setMessage('Profile updated.'); } catch (requestError) { if (requestError instanceof ApiError) setErrors(requestError.fields); setMessage(firstFieldError(requestError)); } finally { setBusy(false); } };
  const verifyPassword = async () => { setDeleteBusy(true); setDeleteError(''); try { await api('/auth/account/verify-password/', { method: 'POST', body: jsonBody({ password }) }); setDeleteStep('final'); } catch (requestError) { setDeleteError(firstFieldError(requestError, 'password')); } finally { setDeleteBusy(false); } };
  const deleteAccount = async () => { if (confirmation !== 'DELETE') return; setDeleteBusy(true); setDeleteError(''); try { await api('/auth/account/delete/', { method: 'POST', body: jsonBody({ password, confirmation }) }); await clearAuth(); router.dismissAll(); router.replace({ pathname: '/', params: { deleted: '1' } }); } catch (requestError) { setDeleteError(firstFieldError(requestError)); } finally { setDeleteBusy(false); } };
  const closeDelete = () => { if (!deleteBusy) { setDeleteStep(null); setPassword(''); setConfirmation(''); setDeleteError(''); } };
  return <FormScreen>
    <Hero eyebrow="Your account" title="Edit profile" subtitle="Update how you appear to the Japan47 community." />
    {message ? <Notice tone={Object.keys(errors).length ? 'danger' : 'success'}>{message}</Notice> : null}
    <View style={styles.form}><Field label="Nickname" error={errors.nickname}><Input value={nickname} onChangeText={setNickname} maxLength={80} /></Field><Field label="Email" error={errors.email}><Input value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" /></Field><ImagePickerField label="Profile photo" asset={image} onChange={(value) => setImage(value as ImagePicker.ImagePickerAsset | null)} error={errors.profile_image} /><Button label={busy ? 'Saving…' : 'Save profile'} disabled={busy || !email} onPress={save} /></View>
    <View style={styles.danger}><Text style={styles.dangerEyebrow}>DANGER ZONE</Text><Text style={styles.dangerTitle}>Delete account</Text><Text style={styles.dangerCopy}>Permanently remove your account and personal travel data. Submitted places may remain as community content.</Text><Button label="Delete account" variant="danger" onPress={() => setDeleteStep('initial')} /></View>
    <Modal visible={Boolean(deleteStep)} transparent animationType="slide" onRequestClose={closeDelete}><View style={styles.backdrop}><View style={styles.sheet}><ScrollView contentContainerStyle={styles.sheetContent}>
      <Pressable style={styles.close} onPress={closeDelete}><Text style={styles.closeText}>Close</Text></Pressable>
      {deleteStep === 'initial' ? <><Text style={styles.sheetTitle}>Delete your account?</Text><Text style={styles.copy}>Nothing will be deleted until your password and final confirmation are accepted.</Text><Button label="Continue" variant="danger" onPress={() => setDeleteStep('password')} /></> : null}
      {deleteStep === 'password' ? <><Text style={styles.sheetTitle}>Confirm your password</Text>{deleteError ? <Notice tone="danger">{deleteError}</Notice> : null}<Input value={password} onChangeText={setPassword} secureTextEntry placeholder="Current password" /><Button label={deleteBusy ? 'Verifying…' : 'Verify password'} variant="danger" disabled={deleteBusy || !password} onPress={verifyPassword} /></> : null}
      {deleteStep === 'final' ? <><Text style={styles.sheetTitle}>Permanently delete this account</Text>{deleteError ? <Notice tone="danger">{deleteError}</Notice> : null}<Notice tone="danger">This action is permanent and cannot be undone. You will immediately lose account access.</Notice><Text style={styles.copy}>Your profile, reviews, ratings, saved content, badges, and travel progress will be deleted. Places and photos you submitted will remain as platform-managed content under “Japan47 Community”. You will lose direct editing access; later requests must go through support and may be rejected.</Text><Field label='Type "DELETE" exactly'><Input value={confirmation} onChangeText={setConfirmation} autoCapitalize="characters" /></Field><Button label={deleteBusy ? 'Deleting…' : 'Permanently delete account'} variant="danger" disabled={deleteBusy || confirmation !== 'DELETE'} onPress={deleteAccount} /></> : null}
    </ScrollView></View></View></Modal>
  </FormScreen>;
}

const styles = StyleSheet.create({
  form: { gap: spacing.md }, danger: { gap: spacing.md, padding: spacing.lg, borderWidth: 1, borderColor: '#D9A39E', borderRadius: radius.lg, backgroundColor: '#FAEFED' }, dangerEyebrow: { color: colors.danger, fontWeight: '900', fontSize: 10, letterSpacing: 1.5 }, dangerTitle: { color: colors.danger, fontFamily: typography.title, fontWeight: '700', fontSize: 24 }, dangerCopy: { color: colors.muted, lineHeight: 21 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(20,25,20,.48)' }, sheet: { maxHeight: '88%', borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: colors.paper }, sheetContent: { gap: spacing.lg, padding: spacing.xl, paddingBottom: 42 }, close: { alignSelf: 'flex-end', padding: spacing.sm }, closeText: { color: colors.redDark, fontWeight: '800' }, sheetTitle: { color: colors.ink, fontFamily: typography.title, fontWeight: '700', fontSize: 27 }, copy: { color: colors.muted, fontSize: 15, lineHeight: 23 },
});
