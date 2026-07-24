import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api, jsonBody } from '../api/client'
import { ErrorState, LoadingState } from '../components/AsyncState'
import FormField from '../components/FormField'
import { useApi } from '../hooks/useApi'

export default function ReviewFormPage() {
  const { placeId, reviewId } = useParams(); const editing = Boolean(reviewId); const [params] = useSearchParams(); const targetPlace = placeId || params.get('place')
  const navigate = useNavigate(); const { data: place, loading: placeLoading, error: placeError } = useApi(`/places/${targetPlace}/`)
  const { data: review, loading: reviewLoading } = useApi(editing ? `/reviews/${reviewId}/` : '/health/')
  const [rating, setRating] = useState(0); const [comment, setComment] = useState(''); const [errors, setErrors] = useState({}); const [busy, setBusy] = useState(false)
  useEffect(() => { if (editing && review?.id) { setRating(review.rating); setComment(review.comment) } }, [editing, review])
  if (placeLoading || reviewLoading) return <LoadingState />; if (placeError) return <ErrorState error={placeError} />
  const submit = async (e) => { e.preventDefault(); setBusy(true); setErrors({}); try { await api(editing ? `/reviews/${reviewId}/` : '/reviews/', { method: editing ? 'PATCH' : 'POST', body: jsonBody({ place_id: Number(targetPlace), rating, comment }) }); navigate(`/places/${place.id}/${place.slug}`) } catch (err) { setErrors(err.fields || { general: err.message }) } finally { setBusy(false) } }
  return <section className="form-page form-page--small"><div><Link className="back" to={`/places/${place.id}/${place.slug}`}>← Back to {place.name}</Link><p className="eyebrow">{place.prefecture.name} prefecture</p><h1>{editing ? 'Edit your review' : 'Write a review'}</h1><p>Your experience at {place.name}</p></div><form onSubmit={submit}>{errors.general && <p className="form-error">{errors.general}</p>}<fieldset className="rating-picker"><legend>Your rating</legend><div>{[1,2,3,4,5].map((value) => <button type="button" key={value} className={value <= rating ? 'active' : ''} aria-label={`${value} stars`} aria-pressed={rating === value} onClick={() => setRating(value)}>★</button>)}</div>{errors.rating && <p className="field-error">{errors.rating}</p>}</fieldset><FormField label="Your review" name="comment" errors={errors}><textarea id="comment" value={comment} onChange={(e) => setComment(e.target.value)} rows="6" placeholder="Share your experience" /></FormField><div className="actions"><button className="button button--primary" disabled={busy || !rating}>{busy ? 'Saving…' : editing ? 'Save review' : 'Publish review'}</button><Link to={`/places/${place.id}/${place.slug}`}>Cancel</Link></div></form></section>
}
