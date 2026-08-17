import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChoiceField, Button, Empty, ErrorState, Hero, Input, Loading, Notice } from '@/components/core';
import { PlaceCard } from '@/components/cards';
import { useApi } from '@/hooks/use-api';
import { api } from '@/lib/api';
import { colors, spacing } from '@/constants/theme';
import type { Paginated, Place, Region } from '@/types/api';

const seasonOptions = [
  { label: 'Any season', value: '' }, { label: 'Spring', value: 'spring' },
  { label: 'Summer', value: 'summer' }, { label: 'Autumn', value: 'autumn' },
  { label: 'Winter', value: 'winter' }, { label: 'Year-round', value: 'year_round' },
];
const orderOptions = [
  { label: 'Newest first', value: '-created_at' }, { label: 'Top rated', value: '-average_rating' },
  { label: 'Most reviewed', value: '-review_count' }, { label: 'Name', value: 'name' },
];

export default function PlacesScreen() {
  const [search, setSearch] = useState('');
  const [season, setSeason] = useState('');
  const [region, setRegion] = useState('');
  const [ordering, setOrdering] = useState('-created_at');
  const [places, setPlaces] = useState<Place[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [initialError, setInitialError] = useState<Error | null>(null);
  const [moreError, setMoreError] = useState<Error | null>(null);
  const [reloadVersion, setReloadVersion] = useState(0);
  const queryVersion = useRef(0);
  const loadingMoreRef = useRef(false);
  const previousInitialUrl = useRef<string | null>(null);
  const regions = useApi<Region[]>('/regions/');
  const initialUrl = useMemo(() => {
    const params = new URLSearchParams({ page: '1', ordering });
    if (search.trim()) params.set('search', search.trim());
    if (season) params.set('best_season', season);
    if (region) params.set('region', region);
    return `/places/?${params}`;
  }, [ordering, region, search, season]);
  const regionOptions = useMemo(() => [{ label: 'All regions', value: '' }, ...(regions.data || []).map((item) => ({ label: item.label, value: item.name }))], [regions.data]);

  useEffect(() => {
    let active = true;
    const version = ++queryVersion.current;
    const filtersChanged = previousInitialUrl.current !== initialUrl;
    previousInitialUrl.current = initialUrl;
    loadingMoreRef.current = false;
    setLoadingMore(false);
    if (filtersChanged) {
      setPlaces([]);
      setNext(null);
    }
    setInitialError(null);
    setMoreError(null);
    setLoadingInitial(true);

    api<Paginated<Place>>(initialUrl)
      .then((page) => {
        if (!active || queryVersion.current !== version) return;
        setPlaces(page.results);
        setNext(page.next);
      })
      .catch((error: unknown) => {
        if (active && queryVersion.current === version) setInitialError(error instanceof Error ? error : new Error('Unable to load places.'));
      })
      .finally(() => {
        if (active && queryVersion.current === version) setLoadingInitial(false);
      });

    return () => { active = false; };
  }, [initialUrl, reloadVersion]);

  const reload = useCallback(() => setReloadVersion((value) => value + 1), []);
  const loadMore = useCallback(async () => {
    if (!next || loadingInitial || loadingMoreRef.current) return;
    const version = queryVersion.current;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const page = await api<Paginated<Place>>(next);
      if (queryVersion.current !== version) return;
      setPlaces((current) => {
        const knownIds = new Set(current.map((place) => place.id));
        return [...current, ...page.results.filter((place) => !knownIds.has(place.id))];
      });
      setNext(page.next);
    } catch (error) {
      if (queryVersion.current === version) setMoreError(error instanceof Error ? error : new Error('Unable to load more places.'));
    } finally {
      if (queryVersion.current === version) {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      }
    }
  }, [loadingInitial, next]);

  return <SafeAreaView style={styles.safe} edges={['left', 'right']}>
    <FlatList
      data={places}
      keyExtractor={(place) => String(place.id)}
      renderItem={({ item }) => <PlaceCard place={item} />}
      contentContainerStyle={styles.content}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      refreshing={loadingInitial}
      onRefresh={reload}
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      ListHeaderComponent={<View style={styles.header}>
        <Hero eyebrow="Community guide" title="Places to discover" subtitle="Browse destinations shared by Japan47 contributors."><Button label="Suggest a place" compact onPress={() => router.push('/places/form')} /></Hero>
        <Input value={search} onChangeText={setSearch} placeholder="Search place, city, prefecture" returnKeyType="search" />
        <ChoiceField label="Region" value={region} options={regionOptions} onChange={setRegion} />
        <ChoiceField label="Best season" value={season} options={seasonOptions} onChange={setSeason} />
        <ChoiceField label="Sort" value={ordering} options={orderOptions} onChange={setOrdering} />
      </View>}
      ListEmptyComponent={loadingInitial ? <Loading /> : initialError ? <ErrorState error={initialError} onRetry={reload} /> : <Empty title="No places match" message="Try changing your filters." />}
      ListFooterComponent={loadingMore ? <View style={styles.footer}><ActivityIndicator color={colors.red} /><Text style={styles.footerText}>Loading more places…</Text></View> : moreError ? <View style={styles.footer}><Notice tone="danger">{moreError.message}</Notice><Button label="Try again" variant="secondary" onPress={loadMore} /></View> : null}
    />
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  content: { padding: spacing.lg, paddingBottom: 48, gap: spacing.xl },
  header: { gap: spacing.xl },
  footer: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg },
  footerText: { color: colors.muted, fontSize: 13 },
});
