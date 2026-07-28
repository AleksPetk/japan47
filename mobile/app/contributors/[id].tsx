import { useLocalSearchParams } from 'expo-router';
import { ErrorState, Loading, Screen } from '@/components/core';
import ProfileView from '@/components/profile-view';
import { useApi } from '@/hooks/use-api';
import type { Profile } from '@/types/api';

export default function ContributorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading, error, reload } = useApi<Profile>(id ? `/contributors/${id}/` : null, [id]);
  return <Screen refreshing={loading} onRefresh={reload}>{loading && !data ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : data ? <ProfileView profile={data} reload={reload} /> : null}</Screen>;
}
