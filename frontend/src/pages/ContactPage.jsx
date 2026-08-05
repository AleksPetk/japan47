import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { ErrorState, LoadingState } from '../components/AsyncState'
import FormField from '../components/FormField'
import Modal from '../components/Modal'
import PageHero from '../components/PageHero'
import { useApi } from '../hooks/useApi'

const initialValues = { category: '', subject: '', contact_email: '', related_url: '', message: '' }

export default function ContactPage() {
  const navigate = useNavigate()
  const { data, loading, error } = useApi('/support/')
  const [values, setValues] = useState(initialValues)
  const [screenshot, setScreenshot] = useState(null)
  const [errors, setErrors] = useState({})
  const [confirming, setConfirming] = useState(false)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (data?.default_contact_email) {
      setValues((current) =>
        current.contact_email ? current : { ...current, contact_email: data.default_contact_email }
      )
    }
  }, [data])

  if (loading) return <LoadingState label="Loading the contact form…" />
  if (error) return <ErrorState error={error} />

  const change = (event) => {
    setValues((current) => ({ ...current, [event.target.name]: event.target.value }))
    setErrors((current) => ({ ...current, [event.target.name]: undefined, general: undefined }))
  }
  const chooseScreenshot = (event) => {
    const file = event.target.files?.[0] || null
    if (file && file.size > 5 * 1024 * 1024) {
      setScreenshot(null)
      setErrors((current) => ({ ...current, screenshot: 'Screenshot must be 5 MB or smaller.' }))
      event.target.value = ''
      return
    }
    setScreenshot(file)
    setErrors((current) => ({ ...current, screenshot: undefined }))
  }
  const reviewRequest = (event) => {
    event.preventDefault()
    setErrors({})
    setConfirming(true)
  }
  const sendRequest = async () => {
    setSending(true)
    try {
      const body = new FormData()
      Object.entries(values).forEach(([key, value]) => body.append(key, value))
      if (screenshot) body.append('screenshot', screenshot)
      const ticket = await api('/support/', { method: 'POST', body })
      navigate(`/contact/success/${encodeURIComponent(ticket.ticket_id)}`, { replace: true })
    } catch (requestError) {
      setConfirming(false)
      setErrors(requestError.fields || { general: requestError.message })
    } finally {
      setSending(false)
    }
  }
  const categoryLabel =
    data.categories.find((item) => item.value === values.category)?.label || values.category

  return (
    <section className="page page--discovery support-page">
      <PageHero
        eyebrow="Japan 47 support"
        title="Contact Us"
        subtitle="Send a private request to the Japan 47 team. We will use your chosen contact email when following up."
      />
      <div className="support-layout">
        <form className="support-form" onSubmit={reviewRequest}>
          <header>
            <h2>How can we help?</h2>
            <p>All fields marked required must be completed before review.</p>
          </header>
          {errors.general && (
            <p className="form-error" role="alert">
              {errors.general}
            </p>
          )}
          {errors.non_field_errors && (
            <p className="form-error" role="alert">
              {Array.isArray(errors.non_field_errors)
                ? errors.non_field_errors.join(' ')
                : errors.non_field_errors}
            </p>
          )}
          <FormField label="Category" name="category" errors={errors} required>
            <select
              id="category"
              name="category"
              value={values.category}
              onChange={change}
              required
            >
              <option value="">Select a category</option>
              {data.categories.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Subject" name="subject" errors={errors} required>
            <input
              id="subject"
              name="subject"
              maxLength="180"
              value={values.subject}
              onChange={change}
              required
            />
          </FormField>
          <FormField
            label="Contact email"
            name="contact_email"
            errors={errors}
            hint="This may differ from your registered account email."
            required
          >
            <input
              id="contact_email"
              name="contact_email"
              type="email"
              autoComplete="email"
              value={values.contact_email}
              onChange={change}
              required
            />
          </FormField>
          <FormField
            label="Related URL"
            name="related_url"
            errors={errors}
            hint="For example, the place, review, or account page involved."
          >
            <input
              id="related_url"
              name="related_url"
              type="url"
              maxLength="500"
              placeholder="https://…"
              value={values.related_url}
              onChange={change}
            />
          </FormField>
          <FormField
            label="Screenshot"
            name="screenshot"
            errors={errors}
            hint="One JPEG, PNG, WebP, HEIC, or HEIF image, up to 5 MB."
          >
            <input
              id="screenshot"
              name="screenshot"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              onChange={chooseScreenshot}
            />
          </FormField>
          <FormField
            label="Message"
            name="message"
            errors={errors}
            hint={`${values.message.length}/5000 characters`}
            required
          >
            <textarea
              id="message"
              name="message"
              rows="9"
              maxLength="5000"
              value={values.message}
              onChange={change}
              required
            />
          </FormField>
          <button className="button button--primary" type="submit">
            Send
          </button>
        </form>
        <aside className="support-guidance">
          <p className="eyebrow">Before sending</p>
          <h2>Help us resolve it faster</h2>
          <p>
            Include the page involved, what you expected, and what happened. Never include your
            password or payment details.
          </p>
          <p>Your request is private and visible only to authorized administrators.</p>
        </aside>
      </div>
      {confirming && (
        <Modal
          title="Send Support Request?"
          onClose={() => !sending && setConfirming(false)}
          actions={
            <>
              <button
                className="button button--ghost"
                type="button"
                disabled={sending}
                onClick={() => setConfirming(false)}
              >
                Cancel
              </button>
              <button
                className="button button--primary"
                type="button"
                disabled={sending}
                onClick={sendRequest}
              >
                {sending ? 'Sending…' : 'Send Request'}
              </button>
            </>
          }
        >
          <p className="support-confirmation-intro">
            Please review your support request before sending.
          </p>
          <dl className="support-summary">
            <div>
              <dt>Category</dt>
              <dd>{categoryLabel}</dd>
            </div>
            <div>
              <dt>Subject</dt>
              <dd>{values.subject}</dd>
            </div>
            <div>
              <dt>Contact email</dt>
              <dd>{values.contact_email}</dd>
            </div>
            <div>
              <dt>Related URL</dt>
              <dd>{values.related_url || 'Not provided'}</dd>
            </div>
            <div>
              <dt>Screenshot</dt>
              <dd>{screenshot?.name || 'Not attached'}</dd>
            </div>
            <div className="support-summary__message">
              <dt>Message</dt>
              <dd>{values.message}</dd>
            </div>
          </dl>
          <p className="support-warning">Once submitted, this support request cannot be edited.</p>
        </Modal>
      )}
    </section>
  )
}

export function SupportSuccessPage() {
  const { ticketId } = useParams()
  return (
    <section className="support-success">
      <span aria-hidden="true">✓</span>
      <p className="eyebrow">Request received</p>
      <h1>Support Request Submitted</h1>
      <p>Thank you for contacting Japan 47. Your support request has been received.</p>
      <p className="support-reference">
        Reference Number <strong>{ticketId}</strong>
      </p>
      <p>Please include this reference number if you contact us again.</p>
      <Link className="button button--primary" to="/">
        Return Home
      </Link>
    </section>
  )
}
