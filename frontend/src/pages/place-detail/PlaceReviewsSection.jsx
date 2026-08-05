import { Link } from 'react-router-dom'
import { EmptyState } from '../../components/AsyncState'
import Rating from '../../components/Rating'
import { formatDate } from '../../utils/format'

export default function PlaceReviewsSection({
  place,
  user,
  ownReview,
  onToggleHelpful,
  onReportReview,
  onRemoveReview,
}) {
  return (
    <section className="reviews">
      <header className="section-header">
        <div>
          <p className="eyebrow">Traveler experiences</p>
          <h2>Reviews</h2>
        </div>
        {user ? (
          <Link
            className="button button--primary"
            to={
              ownReview
                ? `/reviews/${ownReview.id}/edit?place=${place.id}`
                : `/places/${place.id}/reviews/new`
            }
          >
            {ownReview ? 'Edit your review' : 'Write a review'}
          </Link>
        ) : (
          <Link to="/login">Login to review</Link>
        )}
      </header>
      {place.reviews.length ? (
        <>
          <div className="rating-distribution">
            {Object.entries(place.rating_distribution).map(([rating, count]) => (
              <div key={rating}>
                <span>{rating} star</span>
                <i>
                  <b
                    style={{
                      width: `${place.review_count ? (count / place.review_count) * 100 : 0}%`,
                    }}
                  />
                </i>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
          <div className="review-list">
            {place.reviews.map((review) => (
              <article className="review" key={review.id}>
                <header>
                  <Link to={`/contributors/${review.author.id}`}>
                    <span className="avatar">{review.author.display_name[0]}</span>
                    {review.author.display_name}
                  </Link>
                  <Rating value={review.rating} />
                </header>
                {review.comment && <p>{review.comment}</p>}
                <small>{formatDate(review.created_at)}</small>
                {user && (
                  <div className="review-actions">
                    <button onClick={() => onToggleHelpful(review)}>
                      {review.is_helpful ? 'Helpful ✓' : 'Helpful'} ({review.helpful_count})
                    </button>
                    <button onClick={() => onReportReview(review)}>Report</button>
                  </div>
                )}
                {review.can_edit && (
                  <footer>
                    <Link to={`/reviews/${review.id}/edit?place=${place.id}`}>Edit</Link>
                    <button onClick={() => onRemoveReview(review)}>Delete</button>
                  </footer>
                )}
              </article>
            ))}
          </div>
        </>
      ) : (
        <EmptyState title="No reviews yet" message="Share the first traveler perspective." />
      )}
    </section>
  )
}
