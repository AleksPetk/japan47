import { ErrorState, Hero, Loading, Screen } from '@/components/core';
import { RegionCard } from '@/components/cards';
import { useApi } from '@/hooks/use-api';
import type { Region } from '@/types/api';

export default function RegionsScreen() {
  const { data, loading, error, reload } = useApi<Region[]>('/regions/');
  return <Screen refreshing={loading} onRefresh={reload}>
    <Hero eyebrow="Explore Japan" title="Regions of Japan" subtitle="Discover the character, landscapes, and prefectures of every region across the archipelago." />
    {loading && !data ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : data?.map((region) => <RegionCard key={region.id} region={region} />)}
  </Screen>;
}
