import { Link } from 'react-router-dom'
import MediaImage from './MediaImage'
import Rating from './Rating'
import { placePath } from '../utils/format'

export function PlaceCard({ place, rank }) {
  return <article className="card card--place"><Link to={placePath(place)}>
    <div className="card__image"><MediaImage src={place.image_url} alt={place.name} />{rank && <b className="rank">#{rank}</b>}<span className="card__kind">Place</span></div>
    <div className="card__body"><p className="eyebrow">{place.prefecture.name}{place.city ? ` · ${place.city}` : ''}</p><h3>{place.name}</h3><p className="clamp">{place.description}</p><div className="card__footer"><Rating value={place.average_rating} count={place.review_count} /><span aria-hidden="true">Explore ↗</span></div></div>
  </Link></article>
}

export function PrefectureCard({ prefecture, rank }) {
  return <article className="card card--prefecture"><Link to={`/prefectures/${encodeURIComponent(prefecture.name)}`}>
    <div className="card__image"><MediaImage src={prefecture.image_url} alt={`${prefecture.name} prefecture`} mark="県" />{rank && <b className="rank">{String(rank).padStart(2, '0')}</b>}<span className="card__kind">Prefecture</span></div>
    <div className="card__body"><p className="eyebrow">{prefecture.region.label} region</p><h3>{prefecture.name}</h3><p className="clamp">{prefecture.description}</p><div className="card__footer"><Rating value={prefecture.average_rating} /><span>{prefecture.published_place_count} places</span></div></div>
  </Link></article>
}

export function RegionCard({ region, rank }) {
  return <article className="card card--region"><Link to={`/regions/${region.name}`}>
    <div className="card__image"><MediaImage src={region.image_url} alt={`${region.label} region`} mark="日" />{rank && <b className="rank">{String(rank).padStart(2, '0')}</b>}<span className="card__kind">Region</span></div>
    <div className="card__body"><p className="eyebrow">Explore Japan</p><h3>{region.label}</h3><p className="clamp">{region.description}</p><div className="card__footer"><Rating value={region.average_rating} /><span>{region.prefecture_count} prefectures · {region.published_place_count} places</span></div></div>
  </Link></article>
}
