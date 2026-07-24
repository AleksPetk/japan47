import { useState } from 'react'
import { PlaceCard, PrefectureCard, RegionCard } from '../components/Cards'
import { EmptyState, ErrorState, LoadingState } from '../components/AsyncState'
import { useApi } from '../hooks/useApi'
import PageHero from '../components/PageHero'

export default function SearchPage() {
  const [query, setQuery] = useState(''); const term = query.trim()
  const { data, loading, error } = useApi(term.length >= 2 ? `/search/?q=${encodeURIComponent(term)}` : '/search/')
  const total = data ? data.regions.length + data.prefectures.length + data.places.length : 0
  return <section className="page page--discovery"><PageHero eyebrow="Search Japan 47" title="Find your next discovery" subtitle="Search published places, prefectures, and regions."><label className="search-box"><span className="sr-only">Search</span><input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Try Tokyo, castle, or Kansai…" /></label></PageHero>{term.length < 2 ? <EmptyState title="Start with two letters" message="Results will appear as you type." /> : loading ? <LoadingState /> : error ? <ErrorState error={error} /> : !total ? <EmptyState title="No results" message="Try a different place or region name." /> : <div className="search-results">{data.places.length > 0 && <section><h2>Places</h2><div className="grid grid--3">{data.places.map((p) => <PlaceCard key={p.id} place={p} />)}</div></section>}{data.prefectures.length > 0 && <section><h2>Prefectures</h2><div className="grid grid--3">{data.prefectures.map((p) => <PrefectureCard key={p.id} prefecture={p} />)}</div></section>}{data.regions.length > 0 && <section><h2>Regions</h2><div className="grid grid--3">{data.regions.map((r) => <RegionCard key={r.id} region={r} />)}</div></section>}</div>}</section>
}
