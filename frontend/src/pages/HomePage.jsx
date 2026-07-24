import { Link } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import { EmptyState, ErrorState, LoadingState } from '../components/AsyncState'
import { PlaceCard, PrefectureCard, RegionCard } from '../components/Cards'
import PageHero from '../components/PageHero'

function Feature({ eyebrow, title, text, link, linkLabel, children, empty }) {
  return <section className="feature"><header className="section-header"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2><p>{text}</p></div><Link to={link}>{linkLabel} →</Link></header>{empty ? <EmptyState message={empty} /> : children}</section>
}

export default function HomePage() {
  const { data, loading, error } = useApi('/home/')
  const { data: trending } = useApi('/places/trending/')
  const stats = ['regions', 'prefectures', 'places', 'contributors']
  return <>
    <PageHero home eyebrow="日本を旅する" title={<>Discover Japan, <em>one region at a time.</em></>} subtitle="Wander from quiet mountain towns to lantern-lit streets and discover the distinct beauty of Japan’s regions and prefectures." aside={<div className="home-hero-stats" aria-label="Japan 47 statistics">{stats.map((label) => <div key={label}><strong>{data?.stats?.[label] ?? '—'}</strong><span>{label}</span></div>)}</div>}><Link className="button button--primary" to="/regions">Explore the regions</Link><Link className="button button--ghost" to="/register">Join the journey</Link></PageHero>
    {loading && <LoadingState />}{error && <ErrorState error={error} />}{data && <>
      <Feature eyebrow="Fresh discoveries" title="The latest places" text="Recently added destinations from the Japan 47 community." link="/places" linkLabel="See all places" empty={!data.latest_places.length && 'No published places have been added yet.'}><div className="grid grid--3">{data.latest_places.map((place) => <PlaceCard key={place.id} place={place} />)}</div></Feature>
      <Feature eyebrow="Community approved" title="Top-rated places" text="Destinations earning the strongest traveler ratings." link="/places?ordering=-average_rating" linkLabel="View ranking" empty={!data.top_places.length && 'No places have received ratings yet.'}><div className="grid grid--3">{data.top_places.map((place, index) => <PlaceCard key={place.id} place={place} rank={index + 1} />)}</div></Feature>
      <section className="home-archipelago" aria-labelledby="home-archipelago-title"><p className="eyebrow">The archipelago</p><h2 id="home-archipelago-title">Forty-seven prefectures. <span>Countless reasons to explore.</span></h2></section>
      {trending?.results?.length > 0 && <Feature eyebrow="Trending now" title="Popular this month" text="Places receiving the most recent traveler reviews." link="/places?ordering=-review_count" linkLabel="Explore popular places"><div className="grid grid--3">{trending.results.slice(0, 3).map((place) => <PlaceCard key={place.id} place={place} />)}</div></Feature>}
      <Feature eyebrow="Traveler favorites" title="Top-rated prefectures" text="Leading prefectures based on equal-weight place ratings." link="/prefectures?ordering=-average_rating" linkLabel="All prefectures" empty={!data.top_prefectures.length && 'No prefectures have received ratings yet.'}><div className="grid grid--3">{data.top_prefectures.map((item, index) => <PrefectureCard key={item.id} prefecture={item} rank={index + 1} />)}</div></Feature>
      <Feature eyebrow="Across the archipelago" title="Top-rated regions" text="Japan’s leading regions based on equal-weight prefecture ratings." link="/regions" linkLabel="All regions" empty={!data.top_regions.length && 'No regions have received ratings yet.'}><div className="grid grid--3">{data.top_regions.map((item, index) => <RegionCard key={item.id} region={item} rank={index + 1} />)}</div></Feature>
      <Feature eyebrow="Community voices" title="Top contributors" text="Travelers expanding Japan 47 for everyone." link="/places" linkLabel="Explore their work" empty={!data.top_contributors.length && 'No contributor profiles are available yet.'}><div className="grid grid--3">{data.top_contributors.map((person, index) => <Link className="contributor-card" to={`/contributors/${person.id}`} key={person.id}><b>#{index + 1}</b>{person.profile_image_url ? <img src={person.profile_image_url} alt="" /> : <span className="avatar">{person.display_name[0]}</span>}<div><h3>{person.display_name}</h3><p>{person.stats.badge.name}</p><strong>{person.stats.points} points</strong></div><img className="badge-mini" src={`/images/badges/${person.stats.badge.filename}`} alt="" /></Link>)}</div></Feature>
    </>}
  </>
}
