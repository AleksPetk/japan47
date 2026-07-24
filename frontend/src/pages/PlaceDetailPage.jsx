import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { EmptyState, ErrorState, LoadingState } from '../components/AsyncState'
import { PlaceCard } from '../components/Cards'
import MediaImage from '../components/MediaImage'
import Rating from '../components/Rating'
import { useAuth } from '../context/AuthContext'
import { useApi } from '../hooks/useApi'
import { formatDate } from '../utils/format'

export default function PlaceDetailPage() {
  const { id } = useParams(); const { user } = useAuth(); const navigate = useNavigate(); const [revision, setRevision] = useState(0); const [lightbox, setLightbox] = useState(null)
  const [viewerState, setViewerState] = useState(null); const [togglePending, setTogglePending] = useState({ favorite: false, visited: false })
  const { data, loading, error } = useApi(`/places/${id}/`, [id, revision])
  useEffect(() => {
    if (!lightbox) return undefined
    const closeOnEscape = (event) => { if (event.key === 'Escape') setLightbox(null) }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [lightbox])
  if (loading) return <LoadingState />; if (error) return <ErrorState error={error} />
  const ownReview = data.reviews.find((r) => r.author.id === user?.id)
  const currentViewerState = viewerState?.placeId === data.id
    ? viewerState
    : { placeId: data.id, favorite: data.is_favorite, visited: data.is_visited }
  const remove = async () => { if (window.confirm(`Delete ${data.name}? This cannot be undone.`)) { await api(`/places/${data.id}/`, { method: 'DELETE' }); navigate(`/prefectures/${data.prefecture.name}`) } }
  const removeReview = async (review) => { if (window.confirm('Delete this review?')) { await api(`/reviews/${review.id}/`, { method: 'DELETE' }); window.location.reload() } }
  const toggleState = async (kind) => {
    if (togglePending[kind]) return
    const active = currentViewerState[kind]
    setViewerState({ ...currentViewerState, [kind]: !active })
    setTogglePending((pending) => ({ ...pending, [kind]: true }))
    try {
      await api(`/places/${data.id}/${kind}/`, { method: active ? 'DELETE' : 'POST' })
    } catch (requestError) {
      setViewerState((state) => state?.placeId === data.id ? { ...state, [kind]: active } : state)
      throw requestError
    } finally {
      setTogglePending((pending) => ({ ...pending, [kind]: false }))
    }
  }
  const toggleHelpful = async (review) => { await api(`/reviews/${review.id}/helpful/`, { method: review.is_helpful ? 'DELETE' : 'POST' }); setRevision((value) => value + 1) }
  const reportReview = async (review) => { const reason = window.prompt('Briefly explain what should be reviewed by moderators:'); if (reason?.trim()) { await api('/reports/', { method: 'POST', body: JSON.stringify({ review: review.id, reason: reason.trim() }) }); window.alert('Report submitted to the moderation team.') } }
  const share = async () => { const details = { title: data.name, text: data.description.slice(0, 120), url: window.location.href }; if (navigator.share) await navigator.share(details); else { await navigator.clipboard.writeText(details.url); window.alert('Link copied.') } }
  const gallery = [{ id: 'cover', image_url: data.image_url, caption: data.name }, ...data.gallery_images].filter((image) => image.image_url).slice(0, 5)
  return <article className="detail page"><p className="breadcrumbs"><Link to="/places">Places</Link> / <Link to={`/prefectures/${data.prefecture.name}`}>{data.prefecture.name}</Link> / {data.name}</p>
    {data.status !== 'published' && <div className={`status status--${data.status}`}>{data.status}: only you and staff can see this submission.</div>}
    {data.latest_revision?.status === 'pending' && <div className="status status--pending">Your proposed changes are awaiting review. This page continues to show the approved version.</div>}
    {data.latest_revision?.status === 'rejected' && <div className="status status--rejected">Your latest proposed changes were rejected.{data.latest_revision.review_note ? ` ${data.latest_revision.review_note}` : ''} The approved version was not changed.</div>}
    <header className="place-title"><div><p className="eyebrow">{data.prefecture.region.label} · {data.prefecture.name}{data.city ? ` · ${data.city}` : ''}</p><h1>{data.name}</h1><p>Added by <Link to={`/contributors/${data.author.id}`}>{data.author.display_name}</Link> · {formatDate(data.created_at)}</p></div><Rating value={data.average_rating} count={data.review_count} large /></header>
    <div className="owner-actions">{user && <><button className="button" disabled={togglePending.favorite} aria-busy={togglePending.favorite} onClick={() => toggleState('favorite')}>{currentViewerState.favorite ? 'Saved ♥' : 'Save place ♡'}</button><button className="button" disabled={togglePending.visited} aria-busy={togglePending.visited} onClick={() => toggleState('visited')}>{currentViewerState.visited ? 'Visited ✓' : 'Mark visited'}</button></>}<button className="button" onClick={share}>Share</button>{data.can_edit && <><Link className="button" to={`/places/${data.id}/edit`}>Edit place</Link><button className="button button--danger" onClick={remove}>Delete</button></>}</div>
    <div className={`place-gallery place-gallery--${gallery.length === 1 ? 'single' : 'multiple'} place-gallery--count-${gallery.length}`}>{gallery.map((image, index) => <button key={image.id} onClick={() => setLightbox(image)} aria-label={`Open ${image.caption || data.name} image`}><MediaImage src={image.thumbnail_url || image.image_url} alt={image.caption || data.name} priority={index === 0} /></button>)}</div>
    {lightbox && <div className="lightbox" role="dialog" aria-modal="true" aria-label={`${data.name} image`} onClick={() => setLightbox(null)}><button autoFocus aria-label="Close image">×</button><img src={lightbox.image_url} alt={lightbox.caption || data.name} /></div>}
    <div className="detail-columns"><section className="prose"><h2>About this place</h2>{data.description.split('\n').map((p, i) => <p key={i}>{p}</p>)}{data.travel_tips && <aside><b>Travel tips</b><p>{data.travel_tips}</p></aside>}</section><aside className="facts"><h2>Plan your visit</h2><dl><div><dt>Prefecture</dt><dd><Link to={`/prefectures/${data.prefecture.name}`}>{data.prefecture.name}</Link></dd></div>{data.city && <div><dt>City</dt><dd>{data.city}</dd></div>}<div><dt>Best season</dt><dd>{data.best_season.replace('_', ' ')}</dd></div><div><dt>Status</dt><dd>{data.status}</dd></div></dl>{data.google_maps_url && <a target="_blank" rel="noreferrer" href={data.google_maps_url}>Open in Google Maps ↗</a>}{data.official_website && <a target="_blank" rel="noreferrer" href={data.official_website}>Official website ↗</a>}</aside></div>
    <section className="reviews"><header className="section-header"><div><p className="eyebrow">Traveler experiences</p><h2>Reviews</h2></div>{user ? <Link className="button button--primary" to={ownReview ? `/reviews/${ownReview.id}/edit?place=${data.id}` : `/places/${data.id}/reviews/new`}>{ownReview ? 'Edit your review' : 'Write a review'}</Link> : <Link to="/login">Login to review</Link>}</header>
      {data.reviews.length ? <><div className="rating-distribution">{Object.entries(data.rating_distribution).map(([rating, count]) => <div key={rating}><span>{rating} star</span><i><b style={{ width: `${data.review_count ? count / data.review_count * 100 : 0}%` }} /></i><strong>{count}</strong></div>)}</div><div className="review-list">{data.reviews.map((review) => <article className="review" key={review.id}><header><Link to={`/contributors/${review.author.id}`}><span className="avatar">{review.author.display_name[0]}</span>{review.author.display_name}</Link><Rating value={review.rating} /></header>{review.comment && <p>{review.comment}</p>}<small>{formatDate(review.created_at)}</small>{user && <div className="review-actions"><button onClick={() => toggleHelpful(review)}>{review.is_helpful ? 'Helpful ✓' : 'Helpful'} ({review.helpful_count})</button><button onClick={() => reportReview(review)}>Report</button></div>}{review.can_edit && <footer><Link to={`/reviews/${review.id}/edit?place=${data.id}`}>Edit</Link><button onClick={() => removeReview(review)}>Delete</button></footer>}</article>)}</div></> : <EmptyState title="No reviews yet" message="Share the first traveler perspective." />}
    </section>
    {data.related_places.length > 0 && <section className="feature"><header className="section-header"><div><p className="eyebrow">Keep exploring</p><h2>Related places</h2></div></header><div className="grid grid--3">{data.related_places.map((place) => <PlaceCard key={place.id} place={place} />)}</div></section>}
    {data.nearby_places.length > 0 && <section className="feature"><header className="section-header"><div><p className="eyebrow">Close by</p><h2>Nearby places</h2></div></header><div className="grid grid--3">{data.nearby_places.map((place) => <PlaceCard key={place.id} place={place} />)}</div></section>}
  </article>
}
