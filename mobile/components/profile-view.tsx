import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar, Button, Empty, Eyebrow, Rating, Section, StatGrid } from './core';
import { PlaceCard } from './cards';
import { useAuth } from '@/context/auth-context';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { api } from '@/lib/api';
import { badgeAssets } from '@/lib/badge-assets';
import type { Profile } from '@/types/api';

export default function ProfileView({ profile, reload }: { profile: Profile; reload: () => void }) {
  const { user, logout } = useAuth();
  const badge = profile.stats.badge;
  const toggleFollow = async () => { await api(`/contributors/${profile.id}/follow/`, { method: profile.is_following ? 'DELETE' : 'POST' }); reload(); };
  const signOut = async () => { await logout(); router.replace('/'); };
  return <>
    <View style={styles.identity}><Avatar uri={profile.profile_image_url} name={profile.display_name} size={92} /><View style={styles.identityText}><Eyebrow>Japan47 contributor</Eyebrow><Text style={styles.name}>{profile.display_name}</Text><Text style={styles.meta}>Member since {new Date(profile.joined_at).toLocaleDateString()}</Text><Text style={styles.meta}>{profile.follower_count} followers · {profile.following_count} following</Text></View></View>
    {profile.is_owner ? <View style={styles.actions}><Button label="Edit profile" variant="secondary" compact onPress={() => router.push('/profile/edit')} /><Button label="Contact support" variant="ghost" compact onPress={() => router.push('/contact')} /><Button label="Sign out" variant="ghost" compact onPress={signOut} /></View> : user ? <Button label={profile.is_following ? 'Following ✓' : 'Follow'} variant={profile.is_following ? 'secondary' : 'primary'} onPress={toggleFollow} /> : null}
    <View style={styles.badge}><Image source={badgeAssets[badge.filename]} style={styles.badgeImage} contentFit="contain" /><View style={styles.badgeBody}><Text style={styles.badgeLabel}>CURRENT BADGE</Text><Text style={styles.badgeName}>{badge.name}</Text><Text style={styles.badgePoints}>{profile.stats.points} points</Text>{badge.next_name ? <Text style={styles.badgeNext}>{badge.points_until_next} points to {badge.next_name}</Text> : <Text style={styles.badgeNext}>Highest badge achieved</Text>}</View></View>
    <StatGrid items={[{ value: profile.stats.points, label: 'Points' }, { value: profile.stats.published_place_count, label: 'Places' }, { value: profile.stats.review_count, label: 'Reviews' }]} />
    {profile.is_owner ? <StatGrid items={[{ value: profile.stats.visited_count || 0, label: 'Visited' }, { value: `${profile.stats.prefectures_visited || 0}/47`, label: 'Prefectures' }, { value: profile.stats.favorite_count || 0, label: 'Saved' }]} /> : null}
    <Section title="Places" eyebrow="Shared discoveries">{profile.places.length ? profile.places.map((place) => <PlaceCard key={place.id} place={place} />) : <Empty message="No places to show yet." />}</Section>
    <Section title="Reviews" eyebrow="Traveler perspective">{profile.reviews.length ? profile.reviews.map((review) => <Pressable key={review.id} style={styles.review} onPress={() => router.push({ pathname: '/places/[id]', params: { id: String(review.place_id) } })}><View style={styles.reviewHeader}><Text style={styles.reviewTitle}>{review.place_name}</Text><Rating value={review.rating} /></View>{review.comment ? <Text style={styles.reviewText}>{review.comment}</Text> : null}<Text style={styles.meta}>{review.prefecture_name} · {new Date(review.created_at).toLocaleDateString()}</Text></Pressable>) : <Empty message="No reviews to show yet." />}</Section>
    {profile.recent_activity.length ? <Section title="Journey timeline" eyebrow="Recent activity">{profile.recent_activity.map((item, index) => <View key={`${item.type}-${index}`} style={styles.activity}><View style={styles.dot} /><Text style={styles.activityKind}>{item.type === 'place' ? 'Added' : 'Reviewed'}</Text><Text style={styles.activityLabel}>{item.label}</Text><Text style={styles.meta}>{new Date(item.date).toLocaleDateString()}</Text></View>)}</Section> : null}
  </>;
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, padding: spacing.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg },
  identityText: { flex: 1 }, name: { color: colors.ink, fontFamily: typography.title, fontWeight: '700', fontSize: 28 }, meta: { color: colors.muted, fontSize: 12, marginTop: 3 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  badge: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.forest }, badgeImage: { width: 98, height: 98 }, badgeBody: { flex: 1 }, badgeLabel: { color: '#E9A79F', fontSize: 10, fontWeight: '800', letterSpacing: 1.3 }, badgeName: { color: colors.surface, fontFamily: typography.title, fontSize: 22, fontWeight: '700' }, badgePoints: { color: '#E6B45F', fontWeight: '800', marginTop: 4 }, badgeNext: { color: '#D7E0D9', fontSize: 11, marginTop: 4 },
  review: { padding: spacing.lg, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surface, gap: spacing.sm }, reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }, reviewTitle: { flex: 1, color: colors.ink, fontFamily: typography.title, fontWeight: '700', fontSize: 18 }, reviewText: { color: colors.ink, lineHeight: 21 },
  activity: { position: 'relative', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingLeft: spacing.lg, paddingVertical: spacing.sm, borderLeftWidth: 2, borderLeftColor: colors.sage }, dot: { position: 'absolute', left: -6, top: 14, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.red }, activityKind: { color: colors.red, fontWeight: '800', width: 70 }, activityLabel: { flex: 1, color: colors.ink },
});
