import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, ChoiceField, ErrorState, Field, FormScreen, Hero, ImagePickerField, Input, Loading, Notice } from '@/components/core';
import { useAuth } from '@/context/auth-context';
import { spacing } from '@/constants/theme';
import { ApiError, api, firstFieldError } from '@/lib/api';
import { appendImage } from '@/lib/uploads';
import { useApi } from '@/hooks/use-api';
import type { FieldErrors, Place, Prefecture } from '@/types/api';

const initial = { prefecture_id: '', name: '', description: '', city: '', google_maps_url: '', official_website: '', travel_tips: '', best_season: 'year_round', latitude: '', longitude: '' };
const seasons = [{ label: 'Year-round', value: 'year_round' }, { label: 'Spring', value: 'spring' }, { label: 'Summer', value: 'summer' }, { label: 'Autumn', value: 'autumn' }, { label: 'Winter', value: 'winter' }];

export default function PlaceFormScreen() {
  const { id, prefecture } = useLocalSearchParams<{ id?: string; prefecture?: string }>();
  const editing = Boolean(id);
  const { user, loading: authLoading } = useAuth();
  const prefectures = useApi<Prefecture[]>('/prefectures/');
  const place = useApi<Place>(editing ? `/places/${id}/` : null, [id]);
  const [values, setValues] = useState(initial);
  const [image, setImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [gallery, setGallery] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [errors, setErrors] = useState<FieldErrors>({}); const [general, setGeneral] = useState(''); const [busy, setBusy] = useState(false);
  const options = useMemo(() => (prefectures.data || []).map((item) => ({ label: `${item.name} · ${item.region.label}`, value: String(item.id) })), [prefectures.data]);
  useEffect(() => {
    if (editing && place.data) {
      const revision = place.data.latest_revision;
      const source = revision && ['pending', 'rejected'].includes(revision.status) ? revision : place.data;
      setValues({ prefecture_id: String(source.prefecture.id), name: source.name, description: source.description, city: source.city || '', google_maps_url: source.google_maps_url || '', official_website: source.official_website || '', travel_tips: source.travel_tips || '', best_season: source.best_season, latitude: String(source.latitude || ''), longitude: String(source.longitude || '') });
    } else if (!editing && prefectures.data && prefecture) {
      const selected = prefectures.data.find((item) => item.name === prefecture);
      if (selected) setValues((current) => ({ ...current, prefecture_id: String(selected.id) }));
    }
  }, [editing, place.data, prefecture, prefectures.data]);
  if (authLoading || prefectures.loading || (editing && place.loading)) return <FormScreen><Loading /></FormScreen>;
  if (!user) return <FormScreen><Hero eyebrow="Account required" title="Sign in to contribute"><Button label="Sign in" onPress={() => router.replace({ pathname: '/auth/login', params: { next: editing ? `/places/form?id=${id}` : '/places/form' } })} /></Hero></FormScreen>;
  if (place.error) return <FormScreen><ErrorState error={place.error} /></FormScreen>;
  const change = (name: keyof typeof initial, value: string) => setValues((current) => ({ ...current, [name]: value }));
  const submit = async () => { setBusy(true); setErrors({}); setGeneral(''); const body = new FormData(); Object.entries(values).forEach(([key, value]) => body.append(key, value)); if (image) appendImage(body, 'image', image); try { const result = await api<Place>(editing ? `/places/${id}/` : '/places/', { method: editing ? 'PATCH' : 'POST', body }); for (const [index, asset] of gallery.entries()) { const galleryBody = new FormData(); appendImage(galleryBody, 'image', asset); galleryBody.append('display_order', String(index)); await api(`/places/${result.id}/images/`, { method: 'POST', body: galleryBody }); } router.dismissAll(); router.push({ pathname: '/places/[id]', params: { id: String(result.id) } }); } catch (requestError) { if (requestError instanceof ApiError) setErrors(requestError.fields); setGeneral(firstFieldError(requestError)); } finally { setBusy(false); } };
  return <FormScreen>
    <Hero eyebrow={editing ? 'Update your contribution' : 'Community contribution'} title={editing ? 'Edit place' : 'Suggest a place'} subtitle={editing ? 'Approved changes remain live while your proposal is reviewed.' : 'Your destination will be reviewed before publication.'} />
    {general ? <Notice tone="danger">{general}</Notice> : null}
    <View style={styles.form}>
      <ChoiceField label="Prefecture" value={values.prefecture_id} options={options} onChange={(value) => change('prefecture_id', value)} error={errors.prefecture_id} />
      <Field label="Place name" error={errors.name}><Input value={values.name} onChangeText={(value) => change('name', value)} maxLength={120} /></Field>
      <Field label="Description" error={errors.description}><Input value={values.description} onChangeText={(value) => change('description', value)} multiline numberOfLines={7} /></Field>
      <ChoiceField label="Best season" value={values.best_season} options={seasons} onChange={(value) => change('best_season', value)} error={errors.best_season} />
      <ImagePickerField label="Main image" asset={image} onChange={(value) => setImage(value as ImagePicker.ImagePickerAsset | null)} error={errors.image} />
      <ImagePickerField label="Gallery images" asset={gallery} multiple onChange={(value) => setGallery((value as ImagePicker.ImagePickerAsset[]) || [])} error={errors.gallery_images} />
      <Field label="City" error={errors.city}><Input value={values.city} onChangeText={(value) => change('city', value)} /></Field>
      <Field label="Google Maps URL" error={errors.google_maps_url}><Input value={values.google_maps_url} onChangeText={(value) => change('google_maps_url', value)} autoCapitalize="none" keyboardType="url" /></Field>
      <Field label="Official website" error={errors.official_website}><Input value={values.official_website} onChangeText={(value) => change('official_website', value)} autoCapitalize="none" keyboardType="url" /></Field>
      <Field label="Latitude" error={errors.latitude}><Input value={values.latitude} onChangeText={(value) => change('latitude', value)} keyboardType="numbers-and-punctuation" placeholder="Optional" /></Field>
      <Field label="Longitude" error={errors.longitude}><Input value={values.longitude} onChangeText={(value) => change('longitude', value)} keyboardType="numbers-and-punctuation" placeholder="Optional" /></Field>
      <Field label="Travel tips" error={errors.travel_tips}><Input value={values.travel_tips} onChangeText={(value) => change('travel_tips', value)} multiline numberOfLines={4} /></Field>
      <Button label={busy ? 'Saving…' : editing ? 'Submit changes for review' : 'Submit for review'} disabled={busy || !values.prefecture_id || !values.name.trim() || !values.description.trim()} onPress={submit} />
    </View>
  </FormScreen>;
}

const styles = StyleSheet.create({ form: { gap: spacing.lg } });
