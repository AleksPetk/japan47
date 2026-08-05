import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import FormField from '../components/FormField'
import { fieldError } from '../utils/format'

function safeReturnPath(value) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : '/'
}

function AuthShell({ mode }) {
  const registering = mode === 'register'
  const { user, login, register } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [values, setValues] = useState({
    username: '',
    email: '',
    password: '',
    password2: '',
    legal_consent: false,
  })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [emailNotVerified, setEmailNotVerified] = useState(false)
  const returnPath = safeReturnPath(location.state?.from)

  if (user) return <Navigate to={returnPath} replace />

  const change = (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value
    setValues((current) => ({ ...current, [event.target.name]: value }))
    setErrors({})
    setEmailNotVerified(false)
  }
  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setErrors({})
    setEmailNotVerified(false)
    try {
      if (registering) {
        const result = await register(values)
        navigate('/check-email', {
          replace: true,
          state: { email: values.email, maskedEmail: result.masked_email },
        })
      } else {
        await login(values.username, values.password)
        navigate(returnPath, { replace: true })
      }
    } catch (error) {
      setEmailNotVerified(error.code === 'EMAIL_NOT_VERIFIED')
      setErrors(Object.keys(error.fields || {}).length ? error.fields : { general: error.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="auth-page">
      <div className="auth-card">
        <header>
          <span aria-hidden="true">{registering ? '桜' : '旅'}</span>
          <p className="eyebrow">{registering ? 'Begin your journey' : 'Welcome back'}</p>
          <h1>{registering ? 'Create an account' : 'Login'}</h1>
        </header>
        <form onSubmit={submit}>
          {errors.general && (
            <p className="form-error" role="alert">
              {errors.general}
            </p>
          )}
          {emailNotVerified && (
            <Link className="auth-action" to="/check-email">
              Resend Verification Email
            </Link>
          )}
          <FormField label="Username" name="username" errors={errors} required>
            <input
              id="username"
              name="username"
              autoComplete="username"
              value={values.username}
              onChange={change}
              required
            />
          </FormField>
          {registering && (
            <FormField label="Email" name="email" errors={errors} required>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={values.email}
                onChange={change}
                required
              />
            </FormField>
          )}
          <FormField label="Password" name="password" errors={errors} required>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={registering ? 'new-password' : 'current-password'}
              value={values.password}
              onChange={change}
              required
            />
          </FormField>
          {registering && (
            <FormField label="Confirm password" name="password2" errors={errors} required>
              <input
                id="password2"
                name="password2"
                type="password"
                autoComplete="new-password"
                value={values.password2}
                onChange={change}
                required
              />
            </FormField>
          )}
          {registering && (
            <div className="consent-field">
              <input
                id="legal_consent"
                name="legal_consent"
                type="checkbox"
                checked={values.legal_consent}
                onChange={change}
                required
              />
              <label htmlFor="legal_consent">
                I agree to the{' '}
                <Link to="/terms" target="_blank" rel="noopener noreferrer">
                  Terms of Use
                </Link>{' '}
                and{' '}
                <Link to="/privacy" target="_blank" rel="noopener noreferrer">
                  Privacy Policy
                </Link>
                .
              </label>
              {fieldError(errors, 'legal_consent') && (
                <p className="field-error" id="legal_consent-error">
                  {fieldError(errors, 'legal_consent')}
                </p>
              )}
            </div>
          )}
          {!registering && (
            <Link className="auth-card__forgot" to="/forgot-password">
              Forgot password?
            </Link>
          )}
          <button className="button button--primary button--full" disabled={busy}>
            {busy ? 'Please wait…' : registering ? 'Register' : 'Login'}
          </button>
        </form>
        <p>
          {registering ? 'Already have an account?' : 'New to Japan 47?'}{' '}
          <Link to={registering ? '/login' : '/register'}>
            {registering ? 'Login' : 'Create an account'}
          </Link>
        </p>
      </div>
    </section>
  )
}

export const LoginPage = () => <AuthShell mode="login" />
export const RegisterPage = () => <AuthShell mode="register" />
