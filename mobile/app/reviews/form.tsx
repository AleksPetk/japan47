import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, ErrorState, Field, FormScreen, Hero, Input, Loading, Notice } from '@/components/core';
import { useAuth } from '@/context/auth-context';
import { colors, spacing } from '@/constants/theme';
import { ApiError, api, firstFieldError, jsonBody } from '@/lib/api';
import { useApi } from '@/hooks/use-api';
import type { FieldErrors, Place, Review } from '@/types/api';

export default function ReviewFormScreen() {
  const { placeId, reviewId } = useLocalSearchParams<{ placeId: string; reviewId?: string }>();
  const { user, loading: authLoading } = useAuth();
  const place = useApi<Place>(placeId ? `/places/${placeId}/` : null, [placeId]);
  const review = useApi<Review>(reviewId ? `/reviews/${reviewId}/` : null, [reviewId]);
  const [rating, setRating] = useState(0); const [comment, setComment] = useState(''); const [errors, setErrors] = useState<FieldErrors>({}); const [general, setGeneral] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { if (review.data) { setRating(review.data.rating); setComment(review.data.comment || ''); } }, [review.data]);
  if (authLoading || place.loading || (reviewId && review.loading)) return <FormScreen><Loading /></FormScreen>;
  if (!user) return <FormScreen><Hero eyebrow="Account required" title="Sign in to write a review"><Button label="Sign in" onPress={() => router.replace('/auth/login')} /></Hero></FormScreen>;
  if (place.error || !place.data) return <FormScreen><ErrorState error={place.error || new Error('Place not found.')} /></FormScreen>;
  const submit = async () => { setBusy(true); setErrors({}); setGeneral(''); try { await api(reviewId ? `/reviews/${reviewId}/` : '/reviews/', { method: reviewId ? 'PATCH' : 'POST', body: jsonBody({ place_id: Number(placeId), rating, comment }) }); router.dismiss(); router.replace({ pathname: '/places/[id]', params: { id: placeId } }); } catch (requestError) { if (requestError instanceof ApiError) setErrors(requestError.fields); setGeneral(firstFieldError(requestError)); } finally { setBusy(false); } };
  return <FormScreen><Hero eyebrow={`${place.data.prefecture.name} prefecture`} title={reviewId ? 'Edit your review' : 'Write a review'} subtitle={`Your experience at ${place.data.name}`} />{general ? <Notice tone="danger">{general}</Notice> : null}<View style={styles.form}><Field label="Your rating" error={errors.rating}><View style={styles.stars}>{[1, 2, 3, 4, 5].map((value) => <Pressable key={value} accessibilityLabel={`${value} stars`} onPress={() => setRating(value)} style={styles.starButton}><Ionicons name={value <= rating ? 'star' : 'star-outline'} size={38} color={colors.gold} /></Pressable>)}</View></Field><Field label="Your review" error={errors.comment}><Input value={comment} onChangeText={setComment} multiline numberOfLines={7} placeholder="Share your experience" /></Field><Text style={styles.hint}>Your review will be public and linked to your contributor profile.</Text><Button label={busy ? 'Saving…' : reviewId ? 'Save review' : 'Publish review'} disabled={busy || !rating} onPress={submit} /></View></FormScreen>;
}

const styles = StyleSheet.create({ form: { gap: spacing.lg }, stars: { flexDirection: 'row', justifyContent: 'space-between' }, starButton: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }, hint: { color: colors.muted, fontSize: 12, lineHeight: 18 } });
