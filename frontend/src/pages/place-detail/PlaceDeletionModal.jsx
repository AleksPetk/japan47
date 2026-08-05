import Modal from '../../components/Modal'

export default function PlaceDeletionModal({
  placeName,
  deleteReason,
  deleteBusy,
  deleteError,
  onClose,
  onReasonChange,
  onSubmit,
}) {
  return (
    <Modal
      title={`Request deletion of ${placeName}?`}
      onClose={onClose}
      actions={
        <>
          <button
            className="button button--ghost"
            type="button"
            disabled={deleteBusy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="button button--danger"
            type="submit"
            form="place-deletion-request-form"
            disabled={deleteBusy || deleteReason.trim().length < 10}
          >
            {deleteBusy ? 'Sending…' : 'Send deletion request'}
          </button>
        </>
      }
    >
      <form id="place-deletion-request-form" className="place-deletion-form" onSubmit={onSubmit}>
        <p>
          The place will not be deleted now. An administrator will review your reason and either
          permanently delete the place and its related data or reject the request.
        </p>
        <label htmlFor="place-deletion-reason">Why should this place be deleted?</label>
        <textarea
          id="place-deletion-reason"
          rows="6"
          maxLength="1000"
          minLength="10"
          value={deleteReason}
          onChange={onReasonChange}
          disabled={deleteBusy}
          required
          autoFocus
        />
        <small>{deleteReason.length}/1000 characters · minimum 10</small>
        {deleteError && (
          <p className="form-error" role="alert">
            {deleteError}
          </p>
        )}
      </form>
    </Modal>
  )
}
