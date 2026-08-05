import { Link, useParams } from 'react-router-dom'
import { PlaceCard, PrefectureCard } from '../components/Cards'
import { ErrorState, LoadingState } from '../components/AsyncState'
import MediaImage from '../components/MediaImage'
import Rating from '../components/Rating'
import SEO from '../components/SEO'
import { useApi } from '../hooks/useApi'
import { imageContentType, summarize } from '../utils/seo'

export default function RegionDetailPage() {
  const { name } = useParams()
  const { data, loading, error } = useApi(`/regions/${encodeURIComponent(name)}/`)
  if (loading) return <LoadingState />
  if (error) return <ErrorState error={error} />
  const description = summarize(
    data.description,
    `Discover the prefectures, places, and distinctive character of Japan’s ${data.label} region.`
  )
  return (
    <article className="detail page region-detail">
      <SEO
        title={`${data.label} Region Travel Guide | Japan47`}
        description={description}
        canonicalPath={`/regions/${encodeURIComponent(name)}`}
        image={data.image_url}
        imageType={imageContentType(data.image_url)}
      />
      <p className="breadcrumbs">
        <Link to="/regions">Regions</Link> / {data.label}
      </p>
      <header className="region-hero">
        <MediaImage src={data.image_url} alt={`${data.label} region`} mark="日" priority />
        <div className="region-hero__content">
          <p className="eyebrow">Region of Japan</p>
          <h1>{data.label}</h1>
          <Rating value={data.average_rating} large />
        </div>
      </header>
      <section className="region-overview">
        <div className="region-introduction">
          <p className="eyebrow">Discover {data.label}</p>
          <h2>A distinct side of Japan</h2>
          <p>{data.description}</p>
        </div>
        <dl className="region-facts" aria-label={`${data.label} region statistics`}>
          <div>
            <dt>Prefectures</dt>
            <dd>{data.prefecture_count ?? data.prefectures.length}</dd>
          </div>
          <div>
            <dt>Published places</dt>
            <dd>{data.published_place_count}</dd>
          </div>
          {data.top_prefecture && (
            <div className="region-facts__featured">
              <dt>Highest rated</dt>
              <dd>
                <Link to={`/prefectures/${encodeURIComponent(data.top_prefecture.name)}`}>
                  {data.top_prefecture.name} <span aria-hidden="true">→</span>
                </Link>
              </dd>
            </div>
          )}
        </dl>
      </section>
      <section className="feature">
        <header className="section-header">
          <div>
            <p className="eyebrow">Where to go</p>
            <h2>Prefectures in {data.label}</h2>
          </div>
        </header>
        <div className="grid grid--3">
          {data.prefectures.map((item) => (
            <PrefectureCard key={item.id} prefecture={item} />
          ))}
        </div>
      </section>
      {data.popular_places?.length > 0 && (
        <section className="feature">
          <header className="section-header">
            <div>
              <p className="eyebrow">Community favorites</p>
              <h2>Most popular places</h2>
            </div>
          </header>
          <div className="grid grid--3">
            {data.popular_places.map((place) => (
              <PlaceCard key={place.id} place={place} />
            ))}
          </div>
        </section>
      )}
    </article>
  )
}
