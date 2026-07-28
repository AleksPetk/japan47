import { router } from 'expo-router';
import { Button, ErrorState, Hero, Loading, Screen } from '@/components/core';
import ProfileView from '@/components/profile-view';
import { useAuth } from '@/context/auth-context';
import { useApi } from '@/hooks/use-api';
import type { Profile } from '@/types/api';

export default function ProfileTab() {
  const { user, loading: authLoading } = useAuth();
  const profile = useApi<Profile>(user ? `/contributors/${user.id}/` : null, [user?.id]);
  if (authLoading) return <Screen><Loading /></Screen>;
  if (!user) return <Screen><Hero eyebrow="Japan47 community" title="Your travel profile" subtitle="Sign in to see your contributions, badges, reviews, and progress."><Button label="Sign in" onPress={() => router.push('/auth/login')} /><Button label="Create account" variant="secondary" onPress={() => router.push('/auth/register')} /></Hero></Screen>;
  return <Screen refreshing={profile.loading} onRefresh={profile.reload}>{profile.loading && !profile.data ? <Loading /> : profile.error ? <ErrorState error={profile.error} onRetry={profile.reload} /> : profile.data ? <ProfileView profile={profile.data} reload={profile.reload} /> : null}</Screen>;
}
