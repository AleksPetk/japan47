import { useSearchParams } from 'react-router-dom'
import { PrefectureCard } from '../components/Cards'
import { EmptyState, ErrorState, LoadingState } from '../components/AsyncState'
import { useApi } from '../hooks/useApi'
import PageHero from '../components/PageHero'

export default function PrefecturesPage() {
  const [params, setParams] = useSearchParams()
  const { data: regions } = useApi('/regions/')
  const query = params.toString()
  const { data, loading, error } = useApi(`/prefectures/${query ? `?${query}` : ''}`, [query])
  const update = (name, value) => { const next = new URLSearchParams(params); value ? next.set(name, value) : next.delete(name); setParams(next) }
  return <section className="page page--discovery discovery-page--compact-hero prefectures-page"><PageHero eyebrow="Forty-seven stories" title="Japan’s prefectures" subtitle="Search and compare every prefecture by region, rating, and community contributions." />
    <div className="filters"><label>Search<input value={params.get('q') || ''} onChange={(e) => update('q', e.target.value)} placeholder="Prefecture or region" /></label><label>Region<select value={params.get('region') || ''} onChange={(e) => update('region', e.target.value)}><option value="">All regions</option>{regions?.map((r) => <option key={r.name} value={r.name}>{r.label}</option>)}</select></label><label>Minimum rating<select value={params.get('min_rating') || ''} onChange={(e) => update('min_rating', e.target.value)}><option value="">Any rating</option>{[4,3,2,1].map((n) => <option key={n} value={n}>{n}+ stars</option>)}</select></label><label>Sort<select value={params.get('ordering') || ''} onChange={(e) => update('ordering', e.target.value)}><option value="">Region order</option><option value="-average_rating">Rating: best</option><option value="average_rating">Rating: lowest</option><option value="-published_place_count">Most places</option></select></label><button onClick={() => setParams({})}>Reset</button></div>
    {loading ? <LoadingState /> : error ? <ErrorState error={error} /> : data.length ? <section className="discovery-results"><header><div><p className="eyebrow">Browse the map</p><h2>Prefectures to explore</h2></div><span>{data.length} results</span></header><div className="grid grid--3">{data.map((item) => <PrefectureCard key={item.id} prefecture={item} />)}</div></section> : <EmptyState title="No prefectures match" message="Try widening your filters." />}
  </section>
}
