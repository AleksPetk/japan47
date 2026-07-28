import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, ErrorState, Hero, Loading, Notice, Screen, Section, StatGrid } from '@/components/core';
import { ContributorCard, PlaceCard, PrefectureCard, RegionCard } from '@/components/cards';
import { colors, spacing, typography } from '@/constants/theme';
import { useApi } from '@/hooks/use-api';
import type { HomeData } from '@/types/api';

function Horizontal({ children }: { children: React.ReactNode }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontal}>{children}</ScrollView>;
}

export default function HomeScreen() {
  const { deleted } = useLocalSearchParams<{ deleted?: string }>();
  const { data, loading, error, reload } = useApi<HomeData>('/home/');
  return <Screen refreshing={loading} onRefresh={reload}>
    {deleted === '1' ? <Notice tone="success">Your account has been permanently deleted.</Notice> : null}
    <View style={styles.brandRow}><Image source={require('@/assets/images/japan47-logo.png')} style={styles.logo} contentFit="contain" /><Text style={styles.brandTag}>Travel all 47</Text></View>
    <Hero eyebrow="Journey through Japan" title="Discover Japan, one region at a time." subtitle="From quiet mountain towns to lantern-lit streets, find places shared by the Japan47 community.">
      <Button label="Explore regions" compact onPress={() => router.push('/regions')} />
      <Button label="Search" compact variant="secondary" onPress={() => router.push('/(tabs)/explore')} />
    </Hero>
    {loading && !data ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : data ? <>
      <StatGrid items={[
        { value: data.stats.regions, label: 'Regions' }, { value: data.stats.prefectures, label: 'Prefectures' },
        { value: data.stats.places, label: 'Places' }, { value: data.stats.contributors, label: 'Contributors' },
      ]} />
      <Section eyebrow="Fresh discoveries" title="Latest places" action={<Button label="See all" compact variant="ghost" onPress={() => router.push('/places')} />}>
        <Horizontal>{data.latest_places.map((place) => <PlaceCard key={place.id} place={place} horizontal />)}</Horizontal>
      </Section>
      {data.top_places.length ? <Section eyebrow="Community approved" title="Top-rated places"><Horizontal>{data.top_places.map((place) => <PlaceCard key={place.id} place={place} horizontal />)}</Horizontal></Section> : null}
      <View style={styles.archipelago}><Text style={styles.archipelagoTop}>THE ARCHIPELAGO</Text><Text style={styles.archipelagoTitle}>Forty-seven prefectures.</Text><Text style={styles.archipelagoSub}>Countless reasons to explore.</Text></View>
      {data.top_prefectures.length ? <Section eyebrow="Traveler favorites" title="Top prefectures">{data.top_prefectures.map((item) => <PrefectureCard key={item.id} prefecture={item} />)}</Section> : null}
      {data.top_regions.length ? <Section eyebrow="Across Japan" title="Top regions">{data.top_regions.map((item) => <RegionCard key={item.id} region={item} />)}</Section> : null}
      {data.top_contributors.length ? <Section eyebrow="Community voices" title="Top contributors">{data.top_contributors.map((person) => <ContributorCard key={person.id} person={person} points={person.stats.points} badge={person.stats.badge.name} />)}</Section> : null}
    </> : null}
  </Screen>;
}

const styles = StyleSheet.create({
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: -8 },
  logo: { width: 150, height: 58 },
  brandTag: { color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  horizontal: { gap: spacing.md, paddingVertical: 4, paddingRight: spacing.lg },
  archipelago: { alignItems: 'center', padding: spacing.xl, backgroundColor: colors.forest, borderRadius: 18 },
  archipelagoTop: { color: '#E9A79F', fontWeight: '800', letterSpacing: 1.5, fontSize: 10 },
  archipelagoTitle: { color: colors.surface, fontFamily: typography.title, fontWeight: '700', fontSize: 24, marginTop: 5 },
  archipelagoSub: { color: '#D7E0D9', fontFamily: typography.title, fontSize: 19 },
});
