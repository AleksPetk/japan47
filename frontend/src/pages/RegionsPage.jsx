import { RegionCard } from '../components/Cards'
import { EmptyState, ErrorState, LoadingState } from '../components/AsyncState'
import { useApi } from '../hooks/useApi'
import PageHero from '../components/PageHero'
import JapanMap from '../components/JapanMap'

export default function RegionsPage() {
  const { data, loading, error } = useApi('/regions/')
  return <section className="page page--discovery discovery-page--compact-hero regions-page"><PageHero eyebrow="Explore Japan" title="Regions of Japan" subtitle="Discover the character, landscapes, and prefectures of every region across the archipelago." />
    {loading ? <LoadingState /> : error ? <ErrorState error={error} /> : data.length ? <><section className="discovery-results"><header><div><p className="eyebrow">All destinations</p><h2>Nine distinct regions</h2></div><span>{data.length} regions</span></header><div className="grid grid--3">{data.map((region) => <RegionCard key={region.id} region={region} />)}</div></section><JapanMap regions={data} /></> : <EmptyState />}
  </section>
}
