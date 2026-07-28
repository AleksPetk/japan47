import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, ChoiceField, Empty, ErrorState, Hero, Input, Loading, Notice, Screen, Section } from '@/components/core';
import { PlaceCard } from '@/components/cards';
import { useAuth } from '@/context/auth-context';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { api, firstFieldError, jsonBody } from '@/lib/api';
import { useApi } from '@/hooks/use-api';
import type { Collection, Favorite, Itinerary, Paginated, VisitedPlace } from '@/types/api';

function list<T>(value: Paginated<T> | T[] | null) { return Array.isArray(value) ? value : value?.results || []; }

export default function TravelScreen() {
  const { user, loading: authLoading } = useAuth();
  const favorites = useApi<Paginated<Favorite> | Favorite[]>(user ? '/favorites/' : null, [user?.id]);
  const visited = useApi<Paginated<VisitedPlace> | VisitedPlace[]>(user ? '/visited-places/' : null, [user?.id]);
  const collections = useApi<Paginated<Collection> | Collection[]>(user ? '/collections/' : null, [user?.id]);
  const itineraries = useApi<Paginated<Itinerary> | Itinerary[]>(user ? '/itineraries/' : null, [user?.id]);
  const [collectionName, setCollectionName] = useState('');
  const [itineraryName, setItineraryName] = useState('');
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const saved = list(favorites.data);
  const savedOptions = useMemo(() => [{ label: 'Choose saved place', value: '' }, ...saved.map((item) => ({ label: item.place.name, value: String(item.place.id) }))], [saved]);
  const loading = authLoading || favorites.loading || visited.loading || collections.loading || itineraries.loading;
  const error = favorites.error || visited.error || collections.error || itineraries.error;
  const reload = () => { favorites.reload(); visited.reload(); collections.reload(); itineraries.reload(); };
  if (authLoading) return <Screen><Loading /></Screen>;
  if (!user) return <Screen><Hero eyebrow="Your Japan" title="Build your travel story" subtitle="Sign in to save places, track visits, create collections, and plan itineraries."><Button label="Sign in" onPress={() => router.push('/auth/login')} /><Button label="Create account" variant="secondary" onPress={() => router.push('/auth/register')} /></Hero></Screen>;
  const create = async (kind: 'collection' | 'itinerary') => { const name = kind === 'collection' ? collectionName : itineraryName; if (!name.trim()) return; try { await api(kind === 'collection' ? '/collections/' : '/itineraries/', { method: 'POST', body: jsonBody({ name: name.trim() }) }); if (kind === 'collection') setCollectionName(''); else setItineraryName(''); reload(); } catch (requestError) { setMessage(firstFieldError(requestError)); } };
  const addPlace = async (kind: 'collection' | 'itinerary', item: Collection | Itinerary) => { const placeId = Number(selections[`${kind}-${item.id}`]); if (!placeId) return; try { if (kind === 'collection') { const collection = item as Collection; await api(`/collections/${item.id}/`, { method: 'PATCH', body: jsonBody({ place_ids: [...new Set([...collection.places.map((place) => place.id), placeId])] }) }); } else { const itinerary = item as Itinerary; await api(`/itineraries/${item.id}/add_stop/`, { method: 'POST', body: jsonBody({ place_id: placeId, day: 1, position: itinerary.stops.length }) }); } setSelections((current) => ({ ...current, [`${kind}-${item.id}`]: '' })); reload(); } catch (requestError) { setMessage(firstFieldError(requestError)); } };
  return <Screen refreshing={loading} onRefresh={reload}>
    <Hero eyebrow="Your Japan" title="My Travel" subtitle="Saved destinations, visited places, collections, and itinerary planning." />
    {message ? <Notice tone="danger">{message}</Notice> : null}
    {loading && !favorites.data ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : <>
      <Section title="Saved places">{saved.length ? saved.map((item) => <PlaceCard key={item.id} place={item.place} />) : <Empty message="Save destinations to build your personal Japan list." />}</Section>
      <Section title="Visited places">{list(visited.data).length ? list(visited.data).map((item) => <PlaceCard key={item.id} place={item.place} />) : <Empty message="Mark a destination as visited to track your journey." />}</Section>
      <Section title="Collections" eyebrow="Organize ideas"><View style={styles.createRow}><Input value={collectionName} onChangeText={setCollectionName} placeholder="Kyoto ideas" style={styles.flex} /><Button label="Create" compact disabled={!collectionName.trim()} onPress={() => create('collection')} /></View>{list(collections.data).map((item) => <View key={item.id} style={styles.builder}><Text style={styles.builderTitle}>{item.name}</Text><Text style={styles.meta}>{item.places.length} places</Text>{item.places.map((place) => <PlaceCard key={place.id} place={place} horizontal />)}{saved.length ? <><ChoiceField label="Add a saved place" value={selections[`collection-${item.id}`] || ''} options={savedOptions} onChange={(value) => setSelections((current) => ({ ...current, [`collection-${item.id}`]: value }))} /><Button label="Add to collection" variant="secondary" disabled={!selections[`collection-${item.id}`]} onPress={() => addPlace('collection', item)} /></> : null}</View>)}</Section>
      <Section title="Itineraries" eyebrow="Plan a journey"><View style={styles.createRow}><Input value={itineraryName} onChangeText={setItineraryName} placeholder="Seven days in Kansai" style={styles.flex} /><Button label="Create" compact disabled={!itineraryName.trim()} onPress={() => create('itinerary')} /></View>{list(itineraries.data).map((item) => <View key={item.id} style={styles.builder}><Text style={styles.builderTitle}>{item.name}</Text><Text style={styles.meta}>{item.stops.length} stops</Text>{item.stops.map((stop) => <View key={stop.id}><Text style={styles.day}>Day {stop.day}</Text><PlaceCard place={stop.place} horizontal /></View>)}{saved.length ? <><ChoiceField label="Add a saved place" value={selections[`itinerary-${item.id}`] || ''} options={savedOptions} onChange={(value) => setSelections((current) => ({ ...current, [`itinerary-${item.id}`]: value }))} /><Button label="Add to itinerary" variant="secondary" disabled={!selections[`itinerary-${item.id}`]} onPress={() => addPlace('itinerary', item)} /></> : null}</View>)}</Section>
    </>}
  </Screen>;
}

const styles = StyleSheet.create({
  createRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }, flex: { flex: 1 },
  builder: { gap: spacing.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, backgroundColor: colors.surface },
  builderTitle: { color: colors.ink, fontFamily: typography.title, fontWeight: '700', fontSize: 20 }, meta: { color: colors.muted, fontSize: 12 }, day: { color: colors.red, fontWeight: '800', fontSize: 11, textTransform: 'uppercase' },
});
