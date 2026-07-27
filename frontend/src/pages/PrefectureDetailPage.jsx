import { Link, useParams } from 'react-router-dom'
import { PlaceCard } from '../components/Cards'
import { EmptyState, ErrorState, LoadingState } from '../components/AsyncState'
import MediaImage from '../components/MediaImage'
import Rating from '../components/Rating'
import SEO from '../components/SEO'
import { useAuth } from '../context/AuthContext'
import { useApi } from '../hooks/useApi'
import { imageContentType, summarize } from '../utils/seo'

export default function PrefectureDetailPage() {
  const { name } = useParams(); const { user } = useAuth()
  const { data, loading, error } = useApi(`/prefectures/${encodeURIComponent(name)}/`)
  if (loading) return <LoadingState />; if (error) return <ErrorState error={error} />
  const featured = [...data.places].sort((a, b) => (b.average_rating || 0) - (a.average_rating || 0))[0]
  const totalReviews = data.places.reduce((sum, place) => sum + place.review_count, 0)
  const gallery = data.places.filter((place) => place.image_url).slice(0, 4)
  const socialImage = data.image_url || featured?.image_url
  const description = summarize(data.description, `Discover places to visit, traveler recommendations, and local highlights across ${data.name} Prefecture, Japan.`)
  return <article className="detail page prefecture-detail"><SEO title={`${data.name} Prefecture Travel Guide | Japan47`} description={description} canonicalPath={`/prefectures/${encodeURIComponent(data.name)}`} image={socialImage} imageType={imageContentType(socialImage)} /><p className="breadcrumbs"><Link to="/regions">Regions</Link> / <Link to={`/regions/${data.region.name}`}>{data.region.label}</Link> / {data.name}</p>
    <figure className="prefecture-cover"><MediaImage src={data.image_url} alt={`${data.name} prefecture`} mark="県" priority /><figcaption><span>{data.region.label} region</span><strong>{data.name}, Japan</strong></figcaption></figure>
    <section className="prefecture-stats" aria-label={`${data.name} travel statistics`}><div><span>Destinations</span><strong>{data.published_place_count}</strong><small>published places</small></div><div><span>Community</span><strong>{totalReviews}</strong><small>traveler reviews</small></div><div><span>Rating</span><strong>{data.average_rating ? Number(data.average_rating).toFixed(1) : '—'}</strong><small>out of five</small></div></section>
    <section className="prefecture-overview"><p className="eyebrow">Discover {data.name}</p><h2>Experience the prefecture</h2><p className="prefecture-intro">{data.description || 'Community recommendations for this prefecture are growing.'}</p><div className="prefecture-overview__actions"><Link className="button button--primary" to={`/places?prefecture=${encodeURIComponent(data.name)}`}>Explore places</Link>{user && <Link className="button" to={`/places/new?prefecture=${encodeURIComponent(data.name)}`}>Suggest a place</Link>}</div></section>
    {featured && <aside className="prefecture-featured">{featured.image_url && <img src={featured.image_url} alt={featured.name} loading="lazy" decoding="async" />}<div><p className="eyebrow">Featured in {data.name}</p><h2>{featured.name}</h2><Rating value={featured.average_rating} count={featured.review_count} /><p>{featured.description.slice(0, 190)}</p><Link to={`/places/${featured.id}/${featured.slug}`}>Discover {featured.name} <span aria-hidden="true">→</span></Link></div></aside>}
    {gallery.length > 0 && <section className="prefecture-gallery-panel"><header><div><p className="eyebrow">A closer look</p><h2>Scenes from {data.name}</h2></div><span>{gallery.length} destinations</span></header><div className="prefecture-gallery" aria-label={`${data.name} gallery`}>{gallery.map((place) => <Link key={place.id} to={`/places/${place.id}/${place.slug}`}><img src={place.image_url} alt={place.name} loading="lazy" decoding="async" /><span>{place.name}</span></Link>)}</div></section>}
    <section className="feature"><header className="section-header"><div><p className="eyebrow">Community discoveries</p><h2>Places in {data.name}</h2><p>{data.published_place_count} published destination{data.published_place_count === 1 ? '' : 's'}.</p></div><div className="actions"><Link to={`/places?prefecture=${encodeURIComponent(data.name)}`}>See all</Link>{user && <Link className="button button--primary" to={`/places/new?prefecture=${encodeURIComponent(data.name)}`}>Suggest a place</Link>}</div></header>{data.places.length ? <div className="grid grid--3">{data.places.map((place) => <PlaceCard key={place.id} place={place} />)}</div> : <EmptyState title="No places yet" message="Be the first traveler to suggest one." />}</section>
  </article>
}
