import { Link } from 'react-router-dom'

export default function JapanMap({ regions = [] }) {
  return <section className="japan-map" aria-labelledby="japan-map-title"><div><p className="eyebrow">Interactive overview</p><h2 id="japan-map-title">Explore the archipelago</h2><p>Select a region to see its prefectures and community destinations.</p></div><nav aria-label="Regions on the Japan map">{regions.map((region, index) => <Link key={region.name} to={`/regions/${region.name}`} style={{ '--map-step': index }}><strong>{region.label}</strong><span>{region.prefecture_count} prefectures · {region.published_place_count} places</span></Link>)}</nav></section>
}
