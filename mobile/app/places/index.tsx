import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ChoiceField, Button, Empty, ErrorState, Hero, Input, Loading, Screen } from '@/components/core';
import { PlaceCard } from '@/components/cards';
import { useApi } from '@/hooks/use-api';
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
  const [page, setPage] = useState(1);
  const regions = useApi<Region[]>('/regions/');
  const params = new URLSearchParams({ page: String(page), ordering });
  if (search.trim()) params.set('search', search.trim());
  if (season) params.set('best_season', season);
  if (region) params.set('region', region);
  const { data, loading, error, reload } = useApi<Paginated<Place>>(`/places/?${params}`, [search, season, region, ordering, page]);
  const regionOptions = useMemo(() => [{ label: 'All regions', value: '' }, ...(regions.data || []).map((item) => ({ label: item.label, value: item.name }))], [regions.data]);
  const update = (setter: (value: string) => void) => (value: string) => { setter(value); setPage(1); };
  return <Screen refreshing={loading} onRefresh={reload}>
    <Hero eyebrow="Community guide" title="Places to discover" subtitle="Browse destinations shared by Japan47 contributors."><Button label="Suggest a place" compact onPress={() => router.push('/places/form')} /></Hero>
    <Input value={search} onChangeText={update(setSearch)} placeholder="Search place, city, prefecture" returnKeyType="search" />
    <ChoiceField label="Region" value={region} options={regionOptions} onChange={update(setRegion)} />
    <ChoiceField label="Best season" value={season} options={seasonOptions} onChange={update(setSeason)} />
    <ChoiceField label="Sort" value={ordering} options={orderOptions} onChange={update(setOrdering)} />
    {loading && !data ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : data?.results.length ? <>
      {data.results.map((place) => <PlaceCard key={place.id} place={place} />)}
      <Button label={`Load page ${page + 1}`} variant="secondary" disabled={!data.next} onPress={() => setPage((value) => value + 1)} />
      {page > 1 ? <Button label="Previous page" variant="ghost" onPress={() => setPage((value) => value - 1)} /> : null}
    </> : <Empty title="No places match" message="Try changing your filters." />}
  </Screen>;
}
