import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Empty, ErrorState, Eyebrow, Loading, RemoteImage, Screen, Section, StatGrid } from '@/components/core';
import { PlaceCard } from '@/components/cards';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useApi } from '@/hooks/use-api';
import type { Prefecture } from '@/types/api';

export default function PrefectureDetailScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const { data, loading, error, reload } = useApi<Prefecture>(name ? `/prefectures/${encodeURIComponent(name)}/` : null, [name]);
  if (loading && !data) return <Screen><Loading /></Screen>;
  if (error || !data) return <Screen><ErrorState error={error || new Error('Prefecture not found.')} onRetry={reload} /></Screen>;
  const places = data.places || [];
  return <Screen refreshing={loading} onRefresh={reload}>
    <View style={styles.cover}><RemoteImage uri={data.image_url} style={styles.coverImage} placeholder="県" /><View style={styles.overlay} /><View style={styles.coverText}><Eyebrow light>{data.region.label} region</Eyebrow><Text style={styles.title}>{data.name}</Text><Text style={styles.japan}>Japan</Text></View></View>
    <StatGrid items={[{ value: data.published_place_count, label: 'Destinations' }, { value: data.average_rating ? Number(data.average_rating).toFixed(1) : '—', label: 'Rating' }]} />
    <View style={styles.intro}><Eyebrow>Discover {data.name}</Eyebrow><Text style={styles.introTitle}>Experience the prefecture</Text><Text style={styles.description}>{data.description || 'Community recommendations for this prefecture are growing.'}</Text><Button label="Suggest a place" variant="secondary" icon="add" onPress={() => router.push({ pathname: '/places/form', params: { prefecture: data.name } })} /></View>
    <Section title={`Places in ${data.name}`} eyebrow="Community discoveries">{places.length ? places.map((place) => <PlaceCard key={place.id} place={place} />) : <Empty message="Be the first traveler to suggest one." />}</Section>
  </Screen>;
}

const styles = StyleSheet.create({
  cover: { overflow: 'hidden', height: 300, borderRadius: radius.lg, backgroundColor: colors.sage },
  coverImage: { width: '100%', height: '100%' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(13,23,17,.34)' },
  coverText: { position: 'absolute', left: spacing.xl, right: spacing.xl, bottom: spacing.xl },
  title: { color: colors.surface, fontFamily: typography.title, fontWeight: '700', fontSize: 45, lineHeight: 48 },
  japan: { color: '#F5E8E5', fontWeight: '700', marginTop: 2 },
  intro: { gap: spacing.sm, padding: spacing.md, backgroundColor: '#F8F1EE', borderRadius: radius.lg },
  introTitle: { color: colors.ink, fontFamily: typography.title, fontWeight: '700', fontSize: 27 },
  description: { color: colors.muted, fontSize: 16, lineHeight: 25, marginBottom: spacing.sm },
});
