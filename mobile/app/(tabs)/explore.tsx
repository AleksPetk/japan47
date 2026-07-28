import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Empty, ErrorState, Hero, Input, Loading, Screen, Section } from '@/components/core';
import { PlaceCard, PrefectureCard, RegionCard } from '@/components/cards';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useApi } from '@/hooks/use-api';
import type { Place, Prefecture, Region } from '@/types/api';

type SearchData = { regions: Region[]; prefectures: Prefecture[]; places: Place[] };

function ExploreLink({ title, subtitle, icon, onPress }: { title: string; subtitle: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.exploreLink, pressed && styles.pressed]}><View style={styles.icon}><Ionicons name={icon} size={24} color={colors.red} /></View><View style={styles.linkBody}><Text style={styles.linkTitle}>{title}</Text><Text style={styles.linkSubtitle}>{subtitle}</Text></View><Ionicons name="chevron-forward" size={20} color={colors.muted} /></Pressable>;
}

export default function ExploreScreen() {
  const [query, setQuery] = useState('');
  const [term, setTerm] = useState('');
  useEffect(() => { const timer = setTimeout(() => setTerm(query.trim()), 300); return () => clearTimeout(timer); }, [query]);
  const { data, loading, error } = useApi<SearchData>(term.length >= 2 ? `/search/?q=${encodeURIComponent(term)}` : null, [term]);
  const total = data ? data.regions.length + data.prefectures.length + data.places.length : 0;
  return <Screen>
    <Hero eyebrow="Explore Japan47" title="Find your next discovery" subtitle="Search places, prefectures, and regions across Japan." />
    <Input value={query} onChangeText={setQuery} placeholder="Try Tokyo, castle, or Kansai…" returnKeyType="search" autoCapitalize="words" />
    {term.length < 2 ? <View style={styles.links}>
      <ExploreLink title="Regions" subtitle="Nine distinct sides of Japan" icon="map-outline" onPress={() => router.push('/regions')} />
      <ExploreLink title="Prefectures" subtitle="Browse all forty-seven" icon="grid-outline" onPress={() => router.push('/prefectures')} />
      <ExploreLink title="Places" subtitle="Community travel inspiration" icon="location-outline" onPress={() => router.push('/places')} />
      <ExploreLink title="Suggest a place" subtitle="Share a destination you love" icon="add-circle-outline" onPress={() => router.push('/places/form')} />
    </View> : loading ? <Loading label="Searching Japan…" /> : error ? <ErrorState error={error} /> : !total ? <Empty title="No results" message="Try a different place or region name." /> : <>
      {data?.places.length ? <Section title="Places">{data.places.map((item) => <PlaceCard key={item.id} place={item} />)}</Section> : null}
      {data?.prefectures.length ? <Section title="Prefectures">{data.prefectures.map((item) => <PrefectureCard key={item.id} prefecture={item} />)}</Section> : null}
      {data?.regions.length ? <Section title="Regions">{data.regions.map((item) => <RegionCard key={item.id} region={item} />)}</Section> : null}
    </>}
  </Screen>;
}

const styles = StyleSheet.create({
  links: { gap: spacing.md },
  exploreLink: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, backgroundColor: colors.surface },
  pressed: { opacity: 0.7 },
  icon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.redSoft },
  linkBody: { flex: 1 },
  linkTitle: { color: colors.ink, fontFamily: typography.title, fontWeight: '700', fontSize: 18 },
  linkSubtitle: { color: colors.muted, fontSize: 12, marginTop: 2 },
});
