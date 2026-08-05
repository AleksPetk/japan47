import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, jsonBody, tokenStore } from '../api/client'
import FormField from '../components/FormField'
import Modal from '../components/Modal'
import { LoadingState } from '../components/AsyncState'
import { useAuth } from '../context/AuthContext'
import { fieldError } from '../utils/format'

export default function ProfileEditPage() {
  const { user, loading, reloadUser, logout } = useAuth()
  const navigate = useNavigate()
  const [values, setValues] = useState(null)
  const [image, setImage] = useState(null)
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [deleteStep, setDeleteStep] = useState(null)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [deleteErrors, setDeleteErrors] = useState({})
  const [deleteBusy, setDeleteBusy] = useState(false)

  if (loading || !user) return <LoadingState />

  const form = values || { nickname: user.nickname, email: user.email }
  const change = (event) => setValues({ ...form, [event.target.name]: event.target.value })

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    const body = new FormData()
    body.append('nickname', form.nickname)
    body.append('email', form.email)
    if (image) body.append('profile_image', image)
    try {
      const updated = await api('/profile/', { method: 'PATCH', body })
      if (!updated.email_verified) {
        await logout()
        navigate('/check-email', { replace: true, state: { email: form.email } })
        return
      }
      await reloadUser()
      navigate(`/contributors/${user.id}`)
    } catch (error) {
      setErrors(error.fields || { general: error.message })
    } finally {
      setBusy(false)
    }
  }

  const closeDeleteFlow = () => {
    if (deleteBusy) return
    setDeleteStep(null)
    setDeletePassword('')
    setDeleteConfirmation('')
    setDeleteErrors({})
  }

  const verifyPassword = async (event) => {
    event.preventDefault()
    setDeleteBusy(true)
    setDeleteErrors({})
    try {
      await api('/auth/account/verify-password/', {
        method: 'POST',
        body: jsonBody({ password: deletePassword }),
      })
      setDeleteStep('final')
    } catch (error) {
      setDeleteErrors(error.fields || { general: error.message })
    } finally {
      setDeleteBusy(false)
    }
  }

  const deleteAccount = async (event) => {
    event.preventDefault()
    if (deleteConfirmation !== 'DELETE') return
    setDeleteBusy(true)
    setDeleteErrors({})
    try {
      const result = await api('/auth/account/delete/', {
        method: 'POST',
        body: jsonBody({ password: deletePassword, confirmation: deleteConfirmation }),
      })
      setDeletePassword('')
      setDeleteConfirmation('')
      // Remove credentials immediately, then let the public route commit before
      // the auth state change can trigger the protected-route login redirect.
      tokenStore.clear()
      navigate('/', {
        replace: true,
        state: {
          accountDeleted: true,
          successMessage: result.message || 'Your account has been permanently deleted.',
        },
      })
    } catch (error) {
      setDeleteErrors(error.fields || { general: error.message })
    } finally {
      setDeleteBusy(false)
    }
  }

  return (
    <section className="form-page form-page--small profile-settings">
      <div>
        <p className="eyebrow">Your account</p>
        <h1>Edit profile</h1>
        <p>Update how you appear to the Japan 47 community.</p>
      </div>
      <form onSubmit={submit}>
        {errors.general && <p className="form-error">{errors.general}</p>}
        <FormField label="Nickname" name="nickname" errors={errors}>
          <input
            id="nickname"
            name="nickname"
            value={form.nickname}
            onChange={change}
            maxLength="80"
          />
        </FormField>
        <FormField label="Email" name="email" errors={errors} required>
          <input
            id="email"
            name="email"
            type="email"
            value={form.email}
            onChange={change}
            required
          />
        </FormField>
        <FormField label="Profile photo" name="profile_image" errors={errors}>
          <input
            id="profile_image"
            type="file"
            accept="image/*,.heic,.heif"
            onChange={(event) => setImage(event.target.files[0])}
          />
        </FormField>
        <div className="actions">
          <button className="button button--primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save profile'}
          </button>
          <Link to={`/contributors/${user.id}`}>Cancel</Link>
        </div>
      </form>

      <section className="account-danger" aria-labelledby="delete-account-title">
        <div>
          <p className="eyebrow">Danger zone</p>
          <h2 id="delete-account-title">Delete account</h2>
          <p>
            Permanently remove your account and personal travel data. Submitted places may remain as
            community content.
          </p>
        </div>
        <button
          className="button button--danger"
          type="button"
          onClick={() => setDeleteStep('initial')}
        >
          Delete account
        </button>
      </section>

      {deleteStep === 'initial' && (
        <Modal
          title="Delete your account?"
          onClose={closeDeleteFlow}
          actions={
            <>
              <button className="button" type="button" onClick={closeDeleteFlow}>
                Cancel
              </button>
              <button
                className="button button--danger"
                type="button"
                onClick={() => setDeleteStep('password')}
              >
                Continue
              </button>
            </>
          }
        >
          <p>
            This starts a permanent account-deletion process. Nothing will be deleted until your
            password and final confirmation are accepted.
          </p>
        </Modal>
      )}

      {deleteStep === 'password' && (
        <Modal
          title="Confirm your password"
          onClose={closeDeleteFlow}
          actions={
            <>
              <button
                className="button"
                type="button"
                onClick={closeDeleteFlow}
                disabled={deleteBusy}
              >
                Cancel
              </button>
              <button
                className="button button--danger"
                type="submit"
                form="password-verification-form"
                disabled={deleteBusy}
              >
                {deleteBusy ? 'Verifying…' : 'Verify password'}
              </button>
            </>
          }
        >
          <form id="password-verification-form" className="modal-form" onSubmit={verifyPassword}>
            {deleteErrors.general && (
              <p className="form-error" role="alert">
                {deleteErrors.general}
              </p>
            )}
            {fieldError(deleteErrors, 'account') && (
              <p className="form-error" role="alert">
                {fieldError(deleteErrors, 'account')}
              </p>
            )}
            <FormField label="Current password" name="password" errors={deleteErrors} required>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={deletePassword}
                onChange={(event) => setDeletePassword(event.target.value)}
                required
                autoFocus
              />
            </FormField>
          </form>
        </Modal>
      )}

      {deleteStep === 'final' && (
        <Modal
          title="Permanently delete this account"
          onClose={closeDeleteFlow}
          actions={
            <>
              <button
                className="button"
                type="button"
                onClick={closeDeleteFlow}
                disabled={deleteBusy}
              >
                Cancel
              </button>
              <button
                className="button button--danger"
                type="submit"
                form="final-deletion-form"
                disabled={deleteBusy || deleteConfirmation !== 'DELETE'}
              >
                {deleteBusy ? 'Deleting…' : 'Permanently delete account'}
              </button>
            </>
          }
        >
          <form
            id="final-deletion-form"
            className="modal-form deletion-warning"
            onSubmit={deleteAccount}
          >
            {deleteErrors.general && (
              <p className="form-error" role="alert">
                {deleteErrors.general}
              </p>
            )}
            {fieldError(deleteErrors, 'account') && (
              <p className="form-error" role="alert">
                {fieldError(deleteErrors, 'account')}
              </p>
            )}
            <p>
              <strong>This action is permanent and cannot be undone.</strong> You will immediately
              lose access to this account.
            </p>
            <ul>
              <li>
                Your profile, personal account information, profile media, reviews, comments,
                ratings, badges, favourites, saved content, and travel progress will be permanently
                deleted where applicable.
              </li>
              <li>
                Places and place photos you submitted will remain available as platform-managed
                content under the author name <strong>Japan47 Community</strong>.
              </li>
              <li>
                You will no longer be able to edit or delete those retained places through this
                account.
              </li>
              <li>
                A later editing or removal request must be sent through the contact form from a new
                account. Japan47 will review the request and may reject it.
              </li>
            </ul>
            <FormField
              label='Type "DELETE" to confirm'
              name="confirmation"
              errors={deleteErrors}
              required
            >
              <input
                id="confirmation"
                name="confirmation"
                value={deleteConfirmation}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
                autoComplete="off"
                required
              />
            </FormField>
          </form>
        </Modal>
      )}
    </section>
  )
}
