import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { PlaceCard } from '../components/Cards'
import { EmptyState, ErrorState, LoadingState } from '../components/AsyncState'
import Rating from '../components/Rating'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import { formatDate } from '../utils/format'

export default function ProfilePage() {
  const { id } = useParams(); const { user } = useAuth(); const [revision, setRevision] = useState(0); const { data, loading, error } = useApi(`/contributors/${id}/`, [id, revision])
  if (loading) return <LoadingState />; if (error) return <ErrorState error={error} />
  const badge = data.stats.badge
  const toggleFollow = async () => { await api(`/contributors/${id}/follow/`, { method: data.is_following ? 'DELETE' : 'POST' }); setRevision((value) => value + 1) }
  return <article className="profile page"><header className="profile-hero"><div className="profile-identity">{data.profile_image_url ? <img src={data.profile_image_url} alt="" /> : <span className="avatar avatar--large">{data.display_name[0]}</span>}<div><p className="eyebrow">Japan 47 contributor</p><h1>{data.display_name}</h1><p>Member since {formatDate(data.joined_at)} · {data.follower_count} followers · {data.following_count} following</p>{data.is_owner && <p>{data.username} · {data.email}</p>}{data.is_owner ? <Link className="button" to="/profile/edit">Edit profile</Link> : user && <button className="button" onClick={toggleFollow}>{data.is_following ? 'Following ✓' : 'Follow'}</button>}</div></div><aside className="badge-card"><img src={`/images/badges/${badge.filename}`} alt={badge.name} /><div><p>Current badge</p><h2>{badge.name}</h2><strong>{data.stats.points} points</strong><div className="progress"><span style={{ width: `${badge.progress_percent}%` }} /></div><small>{badge.next_name ? `${badge.points_until_next} points to ${badge.next_name}` : 'Highest badge achieved'}</small></div></aside></header><div className="stats"><div><strong>{data.stats.points}</strong><span>Points</span></div><div><strong>{data.stats.published_place_count}</strong><span>Published places</span></div><div><strong>{data.stats.review_count}</strong><span>Reviews</span></div></div>
    {data.is_owner && <div className="stats stats--travel"><div><strong>{data.stats.visited_count}</strong><span>Places visited</span></div><div><strong>{data.stats.prefectures_visited}/47</strong><span>Prefectures explored</span></div><div><strong>{data.stats.favorite_count}</strong><span>Saved places</span></div></div>}
    <section className="feature"><header className="section-header"><div><p className="eyebrow">Shared discoveries</p><h2>Places</h2></div></header>{data.places.length ? <div className="grid grid--3">{data.places.map((p) => <PlaceCard key={p.id} place={p} />)}</div> : <EmptyState message="No places to show yet." />}</section>
    <section className="feature"><header className="section-header"><div><p className="eyebrow">Traveler perspective</p><h2>Reviews</h2></div></header>{data.reviews.length ? <div className="review-list">{data.reviews.map((r) => <article className="review" key={r.id}><header><Link to={`/places/${r.place_id}/${r.place_slug}`}>{r.place_name}</Link><Rating value={r.rating} /></header>{r.comment && <p>{r.comment}</p>}<small>{r.prefecture_name} · {formatDate(r.created_at)}</small></article>)}</div> : <EmptyState message="No reviews to show yet." />}</section>
    {data.recent_activity.length > 0 && <section className="feature"><header className="section-header"><div><p className="eyebrow">Recent activity</p><h2>Journey timeline</h2></div></header><ol className="activity-list">{data.recent_activity.map((item, index) => <li key={`${item.type}-${index}`}><b>{item.type === 'place' ? 'Added' : 'Reviewed'}</b><span>{item.label}</span><time>{formatDate(item.date)}</time></li>)}</ol></section>}
    {data.is_owner && data.favorites.length > 0 && <section className="feature"><header className="section-header"><div><p className="eyebrow">Saved inspiration</p><h2>Favorite places</h2></div></header><div className="grid grid--3">{data.favorites.map((place) => <PlaceCard key={place.id} place={place} />)}</div></section>}
  </article>
}
