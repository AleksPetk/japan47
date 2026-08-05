import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { api, jsonBody } from '../api/client'
import FormField from '../components/FormField'
import { LoadingState } from '../components/AsyncState'

function maskEmail(value) {
  const [local = '', domain = ''] = value.toLowerCase().split('@')
  if (!domain) return ''
  const visible = local.slice(0, local.length > 2 ? 2 : 1)
  return `${visible}${'*'.repeat(Math.max(2, local.length - visible.length))}@${domain}`
}

function AccountResult({ symbol = '✓', eyebrow, title, children, action, secondary }) {
  return (
    <section className="account-result">
      <span aria-hidden="true">{symbol}</span>
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      {children}
      <div className="actions">
        <Link className="button button--primary" to={action.to}>
          {action.label}
        </Link>
        {secondary && (
          <Link className="button button--ghost" to={secondary.to}>
            {secondary.label}
          </Link>
        )}
      </div>
    </section>
  )
}

export function CheckEmailPage() {
  const location = useLocation()
  const [email, setEmail] = useState(location.state?.email || '')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const destination = location.state?.maskedEmail || maskEmail(email)
  const resend = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const result = await api('/auth/resend-verification/', {
        method: 'POST',
        body: jsonBody({ email }),
      })
      setMessage(result.message)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="auth-page">
      <div className="auth-card auth-card--wide">
        <header>
          <span aria-hidden="true">✉</span>
          <p className="eyebrow">One more step</p>
          <h1>Thank You for Registering</h1>
        </header>
        <p>Your Japan47 account has been created.</p>
        <p>
          We sent a confirmation link
          {destination && (
            <>
              {' '}
              to <strong>{destination}</strong>
            </>
          )}
          . Please confirm your email before signing in and using Japan47.
        </p>
        <p className="auth-note">
          Delivery may take a few minutes. Check your spam or junk folder as well.
        </p>
        <form onSubmit={resend} className="resend-form">
          <FormField
            label="Email address"
            name="resend_email"
            errors={error ? { resend_email: error } : {}}
            required
          >
            <input
              id="resend_email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </FormField>
          {message && (
            <p className="form-success" role="status">
              {message}
            </p>
          )}
          <button className="button button--ghost button--full" disabled={busy}>
            {busy ? 'Sending…' : 'Resend Verification Email'}
          </button>
        </form>
        <Link className="button button--primary button--full" to="/login">
          Return to Login
        </Link>
      </div>
    </section>
  )
}

export function VerifyEmailPage() {
  const { token } = useParams()
  const [state, setState] = useState({ loading: true, result: null })
  useEffect(() => {
    let active = true
    api('/auth/verify-email/', { method: 'POST', body: jsonBody({ token }) })
      .then((data) => active && setState({ loading: false, result: data.result }))
      .catch(
        (error) =>
          active && setState({ loading: false, result: error.payload?.result || 'invalid' })
      )
    return () => {
      active = false
    }
  }, [token])
  if (state.loading) return <LoadingState label="Confirming your email…" />
  const content = {
    success: {
      title: 'Email Confirmed Successfully',
      text: 'Your Japan47 account is now ready to use.',
    },
    already_verified: {
      title: 'Email Already Confirmed',
      text: 'Your email address has already been verified.',
    },
    expired: {
      title: 'Verification Link Expired',
      text: 'Request a new confirmation link to finish setting up your account.',
    },
    invalid: {
      title: 'Invalid Verification Link',
      text: 'This link is invalid or no longer available.',
    },
  }[state.result] || {
    title: 'Invalid Verification Link',
    text: 'This link is invalid or no longer available.',
  }
  return (
    <AccountResult
      symbol={state.result === 'success' ? '✓' : '!'}
      eyebrow="Email verification"
      title={content.title}
      action={
        state.result === 'expired'
          ? { to: '/check-email', label: 'Resend Verification Email' }
          : { to: '/login', label: 'Sign In' }
      }
      secondary={state.result === 'invalid' ? { to: '/register', label: 'Register' } : null}
    >
      <p>{content.text}</p>
    </AccountResult>
  )
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const result = await api('/auth/password-reset/request/', {
        method: 'POST',
        body: jsonBody({ email }),
      })
      setMessage(result.message)
    } catch (requestError) {
      setError(requestError.fields?.email || requestError.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="auth-page">
      <div className="auth-card">
        <header>
          <span aria-hidden="true">鍵</span>
          <p className="eyebrow">Account recovery</p>
          <h1>Forgot Password</h1>
        </header>
        <p>
          Enter your registered email address. We will send instructions if an eligible account
          exists.
        </p>
        <form onSubmit={submit}>
          <FormField
            label="Email address"
            name="email"
            errors={error ? { email: error } : {}}
            required
          >
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </FormField>
          {message && (
            <p className="form-success" role="status">
              {message}
            </p>
          )}
          <button className="button button--primary button--full" disabled={busy}>
            {busy ? 'Sending…' : 'Send Reset Instructions'}
          </button>
        </form>
        <p>
          <Link to="/login">Return to Login</Link>
        </p>
      </div>
    </section>
  )
}

export function ResetPasswordPage() {
  const { uid, token } = useParams()
  const navigate = useNavigate()
  const [values, setValues] = useState({ new_password: '', new_password2: '' })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const change = (event) =>
    setValues((current) => ({ ...current, [event.target.name]: event.target.value }))
  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setErrors({})
    try {
      await api('/auth/password-reset/confirm/', {
        method: 'POST',
        body: jsonBody({ uid, token, ...values }),
      })
      navigate('/password-reset-success', { replace: true })
    } catch (requestError) {
      const fields = requestError.fields || {}
      setErrors(Object.keys(fields).length ? fields : { general: requestError.message })
    } finally {
      setBusy(false)
    }
  }
  const nonFieldError = errors.non_field_errors
  return (
    <section className="auth-page">
      <div className="auth-card">
        <header>
          <span aria-hidden="true">鍵</span>
          <p className="eyebrow">Choose a secure password</p>
          <h1>Reset Password</h1>
        </header>
        <form onSubmit={submit}>
          {errors.general && (
            <p className="form-error" role="alert">
              {errors.general}
            </p>
          )}
          {nonFieldError && (
            <p className="form-error" role="alert">
              {Array.isArray(nonFieldError) ? nonFieldError.join(' ') : nonFieldError}
            </p>
          )}
          {errors.token && (
            <p className="form-error" role="alert">
              {Array.isArray(errors.token) ? errors.token.join(' ') : errors.token}
            </p>
          )}
          <FormField label="New Password" name="new_password" errors={errors} required>
            <input
              id="new_password"
              name="new_password"
              type="password"
              autoComplete="new-password"
              value={values.new_password}
              onChange={change}
              required
            />
          </FormField>
          <FormField label="Confirm New Password" name="new_password2" errors={errors} required>
            <input
              id="new_password2"
              name="new_password2"
              type="password"
              autoComplete="new-password"
              value={values.new_password2}
              onChange={change}
              required
            />
          </FormField>
          <button className="button button--primary button--full" disabled={busy}>
            {busy ? 'Changing…' : 'Change Password'}
          </button>
        </form>
      </div>
    </section>
  )
}

export function PasswordResetSuccessPage() {
  return (
    <AccountResult
      eyebrow="Account secured"
      title="Password Changed Successfully"
      action={{ to: '/login', label: 'Sign In' }}
    >
      <p>You can now sign in using your new password.</p>
    </AccountResult>
  )
}
