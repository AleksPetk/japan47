import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { Button, ChoiceField, Field, FormScreen, ImagePickerField, Input, Loading, Notice } from '@/components/core';
import { useAuth } from '@/context/auth-context';
import { colors, spacing, typography } from '@/constants/theme';
import { api, ApiError, firstFieldError } from '@/lib/api';
import { appendImage } from '@/lib/uploads';
import type { FieldErrors } from '@/types/api';

type SupportMeta = {
  categories: { value: string; label: string }[];
  default_contact_email: string;
  screenshot: { max_size_mb: number };
};

export default function ContactScreen() {
  const { user, loading: authLoading } = useAuth();
  const [meta, setMeta] = useState<SupportMeta | null>(null);
  const [category, setCategory] = useState('');
  const [subject, setSubject] = useState('');
  const [email, setEmail] = useState('');
  const [relatedUrl, setRelatedUrl] = useState('');
  const [message, setMessage] = useState('');
  const [screenshot, setScreenshot] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [ticket, setTicket] = useState('');

  useEffect(() => {
    if (!user) return;
    api<SupportMeta>('/support/').then((value) => {
      setMeta(value);
      setCategory(value.categories[0]?.value || '');
      setEmail(value.default_contact_email);
    }).catch((error: unknown) => setErrors({ detail: error instanceof Error ? error.message : 'Unable to load the support form.' }));
  }, [user]);

  if (authLoading) return <FormScreen><Loading /></FormScreen>;
  if (!user) return <FormScreen><Notice tone="warning">Sign in to contact Japan47 support.</Notice><Button label="Sign in" onPress={() => router.replace('/auth/login')} /></FormScreen>;
  if (!meta && !errors.detail) return <FormScreen><Loading label="Preparing support form…" /></FormScreen>;

  const submit = async () => {
    setBusy(true); setErrors({});
    const body = new FormData();
    body.append('category', category); body.append('subject', subject.trim()); body.append('contact_email', email.trim());
    body.append('related_url', relatedUrl.trim()); body.append('message', message.trim());
    if (screenshot) appendImage(body, 'screenshot', screenshot);
    try {
      const response = await api<{ ticket_id: string }>('/support/', { method: 'POST', body });
      setTicket(response.ticket_id);
    } catch (error) {
      if (error instanceof ApiError) setErrors(error.fields);
      else setErrors({ detail: firstFieldError(error) });
    } finally { setBusy(false); }
  };

  if (ticket) return <FormScreen><Text style={styles.title}>Request received</Text><Notice tone="success">Your support ticket is {ticket}. Japan47 will reply to your contact email.</Notice><Button label="Done" onPress={() => router.back()} /></FormScreen>;
  return <FormScreen>
    <Text style={styles.eyebrow}>Japan47 support</Text><Text style={styles.title}>How can we help?</Text>
    <Text style={styles.intro}>Send account, submission, review, or technical questions directly to the moderation team.</Text>
    {errors.detail ? <Notice tone="danger">{firstFieldError({ fields: errors })}</Notice> : null}
    <ChoiceField label="Category" value={category} options={meta?.categories || []} onChange={setCategory} error={errors.category} />
    <Field label="Subject" error={errors.subject}><Input value={subject} onChangeText={setSubject} maxLength={180} /></Field>
    <Field label="Contact email" error={errors.contact_email}><Input value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" /></Field>
    <Field label="Related page URL (optional)" error={errors.related_url}><Input value={relatedUrl} onChangeText={setRelatedUrl} autoCapitalize="none" /></Field>
    <Field label="Message" error={errors.message}><Input value={message} onChangeText={setMessage} multiline maxLength={5000} /></Field>
    <ImagePickerField label={`Screenshot (optional, up to ${meta?.screenshot.max_size_mb || 5} MB)`} asset={screenshot} onChange={(value) => setScreenshot(Array.isArray(value) ? value[0] || null : value)} error={errors.screenshot} />
    <Button label={busy ? 'Sending…' : 'Send request'} disabled={busy || !category || !subject.trim() || !email.trim() || !message.trim()} onPress={submit} />
  </FormScreen>;
}

const styles = StyleSheet.create({
  eyebrow: { color: colors.red, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase', fontSize: 11 },
  title: { color: colors.ink, fontFamily: typography.title, fontWeight: '700', fontSize: 30 },
  intro: { color: colors.muted, lineHeight: 22, marginBottom: spacing.sm },
});
