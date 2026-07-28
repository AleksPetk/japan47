import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { ErrorState, Eyebrow, Loading, Rating, RemoteImage, Screen, Section, StatGrid } from '@/components/core';
import { PlaceCard, PrefectureCard } from '@/components/cards';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useApi } from '@/hooks/use-api';
import type { Region } from '@/types/api';

export default function RegionDetailScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const { data, loading, error, reload } = useApi<Region>(name ? `/regions/${encodeURIComponent(name)}/` : null, [name]);
  if (loading && !data) return <Screen><Loading /></Screen>;
  if (error || !data) return <Screen><ErrorState error={error || new Error('Region not found.')} onRetry={reload} /></Screen>;
  return <Screen refreshing={loading} onRefresh={reload}>
    <View style={styles.cover}><RemoteImage uri={data.image_url} style={styles.coverImage} placeholder="日" /><View style={styles.overlay} /><View style={styles.coverText}><Eyebrow light>Region of Japan</Eyebrow><Text style={styles.title}>{data.label}</Text><Rating value={data.average_rating} large /></View></View>
    <StatGrid items={[{ value: data.prefecture_count, label: 'Prefectures' }, { value: data.published_place_count, label: 'Published places' }]} />
    <View style={styles.intro}><Eyebrow>Discover {data.label}</Eyebrow><Text style={styles.introTitle}>A distinct side of Japan</Text><Text style={styles.description}>{data.description}</Text></View>
    <Section title={`Prefectures in ${data.label}`} eyebrow="Where to go">{data.prefectures?.map((item) => <PrefectureCard key={item.id} prefecture={item} />)}</Section>
    {data.popular_places?.length ? <Section title="Popular places" eyebrow="Community favorites">{data.popular_places.map((place) => <PlaceCard key={place.id} place={place} />)}</Section> : null}
  </Screen>;
}

const styles = StyleSheet.create({
  cover: { overflow: 'hidden', height: 330, borderRadius: radius.lg, backgroundColor: colors.forest },
  coverImage: { width: '100%', height: '100%' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(13,25,17,.42)' },
  coverText: { position: 'absolute', left: spacing.xl, right: spacing.xl, bottom: spacing.xl },
  title: { color: colors.surface, fontFamily: typography.title, fontWeight: '700', fontSize: 48, lineHeight: 52, marginBottom: spacing.sm },
  intro: { paddingHorizontal: spacing.sm },
  introTitle: { color: colors.ink, fontFamily: typography.title, fontWeight: '700', fontSize: 27, marginBottom: spacing.sm },
  description: { color: colors.muted, fontSize: 16, lineHeight: 25 },
});
