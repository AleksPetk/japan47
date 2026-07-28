import { useMemo, useState } from 'react';
import { ChoiceField, ErrorState, Hero, Input, Loading, Screen } from '@/components/core';
import { PrefectureCard } from '@/components/cards';
import { useApi } from '@/hooks/use-api';
import type { Prefecture, Region } from '@/types/api';

export default function PrefecturesScreen() {
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState('');
  const regions = useApi<Region[]>('/regions/');
  const path = `/prefectures/?${new URLSearchParams({ ...(query.trim() ? { q: query.trim() } : {}), ...(region ? { region } : {}) }).toString()}`;
  const { data, loading, error, reload } = useApi<Prefecture[]>(path, [query, region]);
  const options = useMemo(() => [{ label: 'All regions', value: '' }, ...(regions.data || []).map((item) => ({ label: item.label, value: item.name }))], [regions.data]);
  return <Screen refreshing={loading} onRefresh={reload}>
    <Hero eyebrow="Forty-seven stories" title="Japan’s prefectures" subtitle="Browse every prefecture by name or region." />
    <Input value={query} onChangeText={setQuery} placeholder="Search prefectures" />
    <ChoiceField label="Region" value={region} options={options} onChange={setRegion} />
    {loading && !data ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : data?.map((item) => <PrefectureCard key={item.id} prefecture={item} />)}
  </Screen>;
}
