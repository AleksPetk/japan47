export default function PlaceStatusBanners({ data, deletionRequest }) {
  return (
    <>
      {data.status !== 'published' && (
        <div className={`status status--${data.status}`}>
          {data.status}: only you and staff can see this submission.
        </div>
      )}
      {data.latest_revision?.status === 'pending' && (
        <div className="status status--pending">
          Your proposed changes are awaiting review. This page continues to show the approved
          version.
        </div>
      )}
      {data.latest_revision?.status === 'rejected' && (
        <div className="status status--rejected">
          Your latest proposed changes were rejected.
          {data.latest_revision.review_note ? ` ${data.latest_revision.review_note}` : ''} The
          approved version was not changed.
        </div>
      )}
      {deletionRequest?.status === 'pending' && (
        <div className="status status--pending">
          Your deletion request is awaiting administrator review. The place remains available until
          a decision is made.
        </div>
      )}
      {deletionRequest?.status === 'rejected' && (
        <div className="status status--rejected">
          Your deletion request was rejected. The place has not been deleted.
          {deletionRequest.admin_note ? ` ${deletionRequest.admin_note}` : ''}
        </div>
      )}
    </>
  )
}
