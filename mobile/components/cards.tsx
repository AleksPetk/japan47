import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadow, spacing, typography } from '@/constants/theme';
import type { Place, Prefecture, Region, UserSummary } from '@/types/api';
import { Avatar, Eyebrow, Rating, RemoteImage } from './core';

export function PlaceCard({ place, horizontal = false }: { place: Place; horizontal?: boolean }) {
  return <Pressable onPress={() => router.push({ pathname: '/places/[id]', params: { id: String(place.id) } })} style={({ pressed }) => [styles.card, horizontal && styles.cardHorizontal, pressed && styles.pressed]}>
    <RemoteImage uri={place.image_url} style={[styles.image, horizontal && styles.imageHorizontal]} />
    <View style={styles.body}><Eyebrow>{place.prefecture.name}{place.city ? ` · ${place.city}` : ''}</Eyebrow><Text style={styles.title} numberOfLines={2}>{place.name}</Text><Text style={styles.description} numberOfLines={2}>{place.description}</Text><View style={styles.footer}><Rating value={place.average_rating} count={place.review_count} /><Text style={styles.meta}>{place.is_visited ? 'Visited ✓' : place.is_favorite ? 'Saved ♥' : 'Explore →'}</Text></View></View>
  </Pressable>;
}

export function PrefectureCard({ prefecture }: { prefecture: Prefecture }) {
  return <Pressable onPress={() => router.push({ pathname: '/prefectures/[name]', params: { name: prefecture.name } })} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
    <RemoteImage uri={prefecture.image_url} style={styles.image} placeholder="県" />
    <View style={styles.body}><Eyebrow>{prefecture.region.label} region</Eyebrow><Text style={styles.title}>{prefecture.name}</Text><Text style={styles.description} numberOfLines={2}>{prefecture.description}</Text><View style={styles.footer}><Rating value={prefecture.average_rating} /><Text style={styles.meta}>{prefecture.published_place_count} places</Text></View></View>
  </Pressable>;
}

export function RegionCard({ region }: { region: Region }) {
  return <Pressable onPress={() => router.push({ pathname: '/regions/[name]', params: { name: region.name } })} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
    <RemoteImage uri={region.image_url} style={styles.image} placeholder="日" />
    <View style={styles.body}><Eyebrow>Explore Japan</Eyebrow><Text style={styles.title}>{region.label}</Text><Text style={styles.description} numberOfLines={2}>{region.description}</Text><View style={styles.footer}><Rating value={region.average_rating} /><Text style={styles.meta}>{region.prefecture_count} prefectures</Text></View></View>
  </Pressable>;
}

export function ContributorCard({ person, points, badge }: { person: UserSummary; points: number; badge: string }) {
  if (person.id == null) return null;
  return <Pressable onPress={() => router.push({ pathname: '/contributors/[id]', params: { id: String(person.id) } })} style={({ pressed }) => [styles.contributor, pressed && styles.pressed]}><Avatar uri={person.profile_image_url} name={person.display_name} /><View style={styles.contributorBody}><Text style={styles.contributorTitle}>{person.display_name}</Text><Text style={styles.meta}>{badge}</Text><Text style={styles.points}>{points} points</Text></View></Pressable>;
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden', backgroundColor: colors.surface, borderWidth: 1, borderColor: '#E3E2DA', borderRadius: radius.lg, ...shadow },
  cardHorizontal: { width: 286 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  image: { width: '100%', height: 180 },
  imageHorizontal: { height: 150 },
  body: { padding: spacing.lg },
  title: { color: colors.ink, fontFamily: typography.title, fontWeight: '700', fontSize: 22, lineHeight: 27 },
  description: { color: colors.muted, lineHeight: 20, marginTop: spacing.xs, minHeight: 40 },
  footer: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  meta: { color: colors.muted, fontSize: 12 },
  contributor: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', padding: spacing.lg, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, backgroundColor: colors.surface },
  contributorBody: { flex: 1 },
  contributorTitle: { color: colors.ink, fontFamily: typography.title, fontWeight: '700', fontSize: 18 },
  points: { color: colors.red, fontWeight: '800', marginTop: 2 },
});
