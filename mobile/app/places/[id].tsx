import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import {
  Avatar, Button, confirm, Empty, ErrorState, Eyebrow, Input, Loading, Notice,
  Rating, RemoteImage, Screen, Section,
} from '@/components/core';
import { PlaceCard } from '@/components/cards';
import { useAuth } from '@/context/auth-context';
import { colors, radius, shadow, spacing, typography } from '@/constants/theme';
import { api, firstFieldError, jsonBody } from '@/lib/api';
import { useApi } from '@/hooks/use-api';
import type { Place, Review } from '@/types/api';

function ActionModal({ visible, title, value, onChange, onClose, onSubmit, busy, minimum = 1, placeholder }: {
  visible: boolean; title: string; value: string; onChange: (value: string) => void; onClose: () => void;
  onSubmit: () => void; busy: boolean; minimum?: number; placeholder: string;
}) {
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={styles.modalCard}><Text style={styles.modalTitle}>{title}</Text><Input value={value} onChangeText={onChange} placeholder={placeholder} multiline numberOfLines={5} /><View style={styles.modalActions}><Button label="Cancel" variant="ghost" onPress={onClose} /><Button label={busy ? 'Sending…' : 'Send'} disabled={busy || value.trim().length < minimum} onPress={onSubmit} /></View></View></View></Modal>;
}

function ReviewCard({ review, place, reload }: { review: Review; place: Place; reload: () => void }) {
  const { user } = useAuth();
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const helpful = async () => { if (!user) return router.push('/auth/login'); await api(`/reviews/${review.id}/helpful/`, { method: review.is_helpful ? 'DELETE' : 'POST' }); reload(); };
  const remove = async () => { if (await confirm('Delete review?', 'This review will be permanently removed.')) { await api(`/reviews/${review.id}/`, { method: 'DELETE' }); reload(); } };
  const report = async () => { setBusy(true); try { await api('/reports/', { method: 'POST', body: jsonBody({ review: review.id, reason: reason.trim() }) }); setReporting(false); setReason(''); } finally { setBusy(false); } };
  return <View style={styles.review}><View style={styles.reviewHeader}><Pressable style={styles.author} onPress={() => review.author.id && router.push({ pathname: '/contributors/[id]', params: { id: String(review.author.id) } })}><Avatar uri={review.author.profile_image_url} name={review.author.display_name} size={38} /><Text style={styles.authorName}>{review.author.display_name}</Text></Pressable><Rating value={review.rating} /></View>{review.comment ? <Text style={styles.reviewText}>{review.comment}</Text> : null}<Text style={styles.date}>{new Date(review.created_at).toLocaleDateString()}</Text><View style={styles.reviewActions}><Pressable onPress={helpful}><Text style={styles.textAction}>{review.is_helpful ? 'Helpful ✓' : 'Helpful'} ({review.helpful_count})</Text></Pressable>{user ? <Pressable onPress={() => setReporting(true)}><Text style={styles.textAction}>Report</Text></Pressable> : null}{review.can_edit ? <><Pressable onPress={() => router.push({ pathname: '/reviews/form', params: { placeId: String(place.id), reviewId: String(review.id) } })}><Text style={styles.textAction}>Edit</Text></Pressable><Pressable onPress={remove}><Text style={[styles.textAction, styles.dangerText]}>Delete</Text></Pressable></> : null}</View><ActionModal visible={reporting} title="Report this review" value={reason} onChange={setReason} onClose={() => setReporting(false)} onSubmit={report} busy={busy} minimum={5} placeholder="Explain what the moderators should review" /></View>;
}

export default function PlaceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { data, loading, error, reload, setData } = useApi<Place>(id ? `/places/${id}/` : null, [id]);
  const [deleting, setDeleting] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  if (loading && !data) return <Screen><Loading /></Screen>;
  if (error || !data) return <Screen><ErrorState error={error || new Error('Place not found.')} onRetry={reload} /></Screen>;
  const place = data;
  const requireAuth = (callback: () => void) => user ? callback() : router.push('/auth/login');
  const toggle = async (kind: 'favorite' | 'visited') => requireAuth(async () => {
    const field = kind === 'favorite' ? 'is_favorite' : 'is_visited';
    const active = place[field];
    setData({ ...place, [field]: !active });
    try { await api(`/places/${place.id}/${kind}/`, { method: active ? 'DELETE' : 'POST' }); } catch (requestError) { setData(place); setMessage(firstFieldError(requestError)); }
  });
  const submitDeletion = async () => { setBusy(true); setMessage(''); try { const result = await api<{ message: string; deletion_request: Place['deletion_request'] }>(`/places/${place.id}/deletion-request/`, { method: 'POST', body: jsonBody({ reason: deleteReason.trim() }) }); setData({ ...place, deletion_request: result.deletion_request }); setDeleting(false); setDeleteReason(''); setMessage(result.message); } catch (requestError) { setMessage(firstFieldError(requestError, 'reason')); } finally { setBusy(false); } };
  const gallery = [{ id: -1, image_url: place.image_url, thumbnail_url: place.image_url, caption: place.name }, ...(place.gallery_images || [])].filter((image) => image.image_url);
  const ownReview = place.reviews?.find((review) => review.author.id === user?.id);
  return <Screen refreshing={loading} onRefresh={reload}>
    {place.status !== 'published' ? <Notice tone="warning">{place.status}: only you and staff can see this submission.</Notice> : null}
    {place.latest_revision?.status === 'pending' ? <Notice tone="warning">Your proposed changes are awaiting review. The approved version remains public.</Notice> : null}
    {place.deletion_request?.status === 'pending' ? <Notice tone="warning">Your deletion request is awaiting administrator review.</Notice> : null}
    {message ? <Notice tone="success">{message}</Notice> : null}
    <View><Eyebrow>{place.prefecture.region.label} · {place.prefecture.name}{place.city ? ` · ${place.city}` : ''}</Eyebrow><Text style={styles.title}>{place.name}</Text><View style={styles.titleMeta}><Rating value={place.average_rating} count={place.review_count} large /><Text style={styles.date}>Added by {place.author.display_name}</Text></View></View>
    <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gallery}>{gallery.length ? gallery.map((image) => <RemoteImage key={image.id} uri={image.image_url} style={styles.galleryImage} />) : <RemoteImage style={styles.galleryImage} />}</ScrollView>
    <View style={styles.actionGrid}>
      <Button label={place.is_favorite ? 'Saved ♥' : 'Save'} variant={place.is_favorite ? 'primary' : 'secondary'} compact onPress={() => toggle('favorite')} />
      <Button label={place.is_visited ? 'Visited ✓' : 'Mark visited'} variant={place.is_visited ? 'primary' : 'secondary'} compact onPress={() => toggle('visited')} />
      <Button label="Share" variant="secondary" compact icon="share-outline" onPress={() => Share.share({ title: place.name, message: `https://japan47.alekspetk.com/places/${place.id}/${place.slug}` })} />
      {place.can_edit ? <Button label="Edit" variant="secondary" compact onPress={() => router.push({ pathname: '/places/form', params: { id: String(place.id) } })} /> : null}
    </View>
    {user?.id === place.author.id && place.deletion_request?.status !== 'pending' ? <Button label="Request deletion" variant="danger" onPress={() => setDeleting(true)} /> : null}
    <View style={styles.prose}><Text style={styles.heading}>About this place</Text><Text style={styles.description}>{place.description}</Text>{place.travel_tips ? <Notice><Text style={styles.bold}>Travel tip: </Text>{place.travel_tips}</Notice> : null}</View>
    <View style={styles.facts}><Text style={styles.heading}>Plan your visit</Text><Text style={styles.fact}>Prefecture  ·  {place.prefecture.name}</Text>{place.city ? <Text style={styles.fact}>City  ·  {place.city}</Text> : null}<Text style={styles.fact}>Best season  ·  {place.best_season.replace('_', ' ')}</Text>{place.google_maps_url ? <Button label="Open Google Maps" variant="secondary" onPress={() => Linking.openURL(place.google_maps_url!)} /> : null}{place.official_website ? <Button label="Official website" variant="ghost" onPress={() => Linking.openURL(place.official_website!)} /> : null}</View>
    <Section title="Reviews" eyebrow="Traveler experiences" action={<Button label={ownReview ? 'Edit yours' : 'Write review'} compact onPress={() => requireAuth(() => router.push({ pathname: '/reviews/form', params: { placeId: String(place.id), ...(ownReview ? { reviewId: String(ownReview.id) } : {}) } }))} />}>
      {place.reviews?.length ? place.reviews.map((review) => <ReviewCard key={review.id} review={review} place={place} reload={reload} />) : <Empty title="No reviews yet" message="Share the first traveler perspective." />}
    </Section>
    {place.related_places?.length ? <Section title="Related places" eyebrow="Keep exploring">{place.related_places.map((item) => <PlaceCard key={item.id} place={item} />)}</Section> : null}
    {place.nearby_places?.length ? <Section title="Nearby" eyebrow="Close by">{place.nearby_places.map((item) => <PlaceCard key={item.id} place={item} />)}</Section> : null}
    <ActionModal visible={deleting} title={`Request deletion of ${place.name}`} value={deleteReason} onChange={setDeleteReason} onClose={() => !busy && setDeleting(false)} onSubmit={submitDeletion} busy={busy} minimum={10} placeholder="Explain why this place should be deleted" />
  </Screen>;
}

const styles = StyleSheet.create({
  title: { color: colors.ink, fontFamily: typography.title, fontWeight: '700', fontSize: 36, lineHeight: 41 },
  titleMeta: { gap: spacing.sm, marginTop: spacing.sm },
  date: { color: colors.muted, fontSize: 12 },
  gallery: { gap: spacing.sm },
  galleryImage: { width: 340, maxWidth: '85%', height: 270, borderRadius: radius.lg, backgroundColor: colors.sage },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  prose: { gap: spacing.md },
  heading: { color: colors.ink, fontFamily: typography.title, fontWeight: '700', fontSize: 23 },
  description: { color: colors.muted, fontSize: 16, lineHeight: 26 },
  bold: { fontWeight: '800' },
  facts: { gap: spacing.md, backgroundColor: colors.surface, padding: spacing.lg, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, ...shadow },
  fact: { color: colors.muted, fontSize: 14, textTransform: 'capitalize' },
  review: { padding: spacing.lg, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, backgroundColor: colors.surface, gap: spacing.sm },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  author: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  authorName: { color: colors.ink, fontWeight: '700' },
  reviewText: { color: colors.ink, lineHeight: 22 },
  reviewActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  textAction: { color: colors.redDark, fontWeight: '700', fontSize: 12 },
  dangerText: { color: colors.danger },
  modalBackdrop: { flex: 1, padding: spacing.lg, backgroundColor: 'rgba(20,25,20,.48)', justifyContent: 'center' },
  modalCard: { gap: spacing.lg, padding: spacing.xl, borderRadius: radius.lg, backgroundColor: colors.paper },
  modalTitle: { color: colors.ink, fontFamily: typography.title, fontWeight: '700', fontSize: 23 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
});
