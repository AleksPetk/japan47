import { ratingText } from '../utils/format'

export default function Rating({ value, count, large = false }) {
  return <div className={`rating ${large ? 'rating--large' : ''}`} aria-label={value == null ? 'Not yet rated' : `${ratingText(value)} out of 5`}>
    <span aria-hidden="true">★</span><strong>{ratingText(value)}</strong>
    {count != null && <small>{count} review{count === 1 ? '' : 's'}</small>}
  </div>
}
