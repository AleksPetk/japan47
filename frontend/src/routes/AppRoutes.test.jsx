import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../context/AuthContext'
import AppRoutes from './AppRoutes'
import { tokenStore } from '../api/client'

const json = (body, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))
const renderRoute = (path) => render(<MemoryRouter initialEntries={[path]}><AuthProvider><AppRoutes /></AuthProvider></MemoryRouter>)

afterEach(() => {
  vi.restoreAllMocks()
  tokenStore.clear()
})

describe('Japan 47 routes', () => {
  it('renders the public Support Japan47 page and safe Ko-fi link', () => {
    renderRoute('/support')
    expect(screen.getByRole('heading', { name: 'Support Japan47', level: 1 })).toBeInTheDocument()
    expect(screen.getByText(/supporting does not unlock premium content/i)).toBeInTheDocument()
    const supportLinks = screen.getAllByRole('link', { name: 'Support on Ko-fi' })
    supportLinks.forEach((link) => {
      expect(link).toHaveAttribute('href', 'https://ko-fi.com/japan47')
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    })
    expect(screen.getByRole('contentinfo')).toHaveTextContent('Support Japan47')
  })

  it('shows loading and then renders API-backed home content', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => json({ latest_places: [], top_places: [], top_prefectures: [], top_regions: [], top_contributors: [] }))
    renderRoute('/')
    expect(screen.getByRole('status')).toHaveTextContent('Loading Japan 47')
    expect(await screen.findByRole('heading', { name: 'The latest places' })).toBeInTheDocument()
    expect(screen.getByText('No published places have been added yet.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Register' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /theme/i })).not.toBeInTheDocument()
  })

  it('renders a useful API error state', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => json({ error: { code: 'service_unavailable', message: 'Please try later.' } }, 503))
    renderRoute('/regions')
    expect(await screen.findByRole('alert')).toHaveTextContent('Please try later.')
  })

  it('submits login credentials and navigates to the requested protected page', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      if (String(url).endsWith('/auth/login/')) return json({ access: 'access-token', refresh: 'refresh-token' })
      if (String(url).endsWith('/profile/')) return json({ id: 7, display_name: 'Sakura', profile_image_url: null, nickname: 'Sakura', email: 'sakura@example.com' })
      if (String(url).endsWith('/home/')) return json({ latest_places: [], top_places: [], top_prefectures: [], top_regions: [], top_contributors: [] })
      if (String(url).endsWith('/prefectures/')) return json([])
      if (String(url).endsWith('/health/')) return json({ status: 'ok' })
      return json({ status: 'ok' })
    })
    renderRoute('/login')
    await userEvent.type(screen.getByLabelText('Username'), 'sakura')
    await userEvent.type(screen.getByLabelText('Password'), 'StrongPass123!')
    await userEvent.click(screen.getByRole('button', { name: 'Login' }))
    await waitFor(() => expect(screen.getByText('Sakura')).toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/auth/login/'), expect.objectContaining({ method: 'POST' }))
  })

  it('clears authentication and redirects to home after logout', async () => {
    tokenStore.set({ access: 'access-token', refresh: 'refresh-token' })
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      if (String(url).endsWith('/profile/')) return json({ id: 7, display_name: 'Sakura', profile_image_url: null })
      if (String(url).endsWith('/auth/logout/')) return Promise.resolve(new Response(null, { status: 204 }))
      if (String(url).endsWith('/home/')) return json({ stats: {}, latest_places: [], top_places: [], top_prefectures: [], top_regions: [], top_contributors: [] })
      if (String(url).endsWith('/places/trending/')) return json({ results: [] })
      if (String(url).endsWith('/regions/')) return json([])
      return json({})
    })
    renderRoute('/regions')
    await screen.findByText('Sakura')
    await userEvent.click(screen.getByRole('button', { name: 'Logout' }))
    expect(await screen.findByRole('heading', { name: /Discover Japan/ })).toBeInTheDocument()
    expect(tokenStore.get()).toBeNull()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/logout/'),
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('keeps discovery filters in the URL-backed API request', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      if (String(url).includes('/places/')) return json({ count: 0, page: 1, pages: 1, next: null, previous: null, results: [] })
      return json([])
    })
    renderRoute('/places?region=kanto&best_season=spring')
    expect(await screen.findByText('No places match')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/places/?region=kanto&best_season=spring'), expect.any(Object))
  })

  it('redirects anonymous visitors to login and returns them to contact', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      if (String(url).endsWith('/auth/login/')) return json({ access: 'access-token', refresh: 'refresh-token' })
      if (String(url).endsWith('/profile/')) return json({ id: 9, display_name: 'Aiko', profile_image_url: null, email: 'aiko@example.com' })
      if (String(url).endsWith('/support/')) return json({
        default_contact_email: 'aiko@example.com',
        categories: [{ value: 'account', label: 'Account' }],
      })
      return json({})
    })
    renderRoute('/contact')
    expect(await screen.findByRole('heading', { name: 'Login' })).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Username'), 'aiko')
    await userEvent.type(screen.getByLabelText('Password'), 'StrongPass123!')
    await userEvent.click(screen.getByRole('button', { name: 'Login' }))
    expect(await screen.findByRole('heading', { name: 'Contact Us' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText('Contact email')).toHaveValue('aiko@example.com'))
  })

  it('reviews values before submitting the support request and shows its reference', async () => {
    tokenStore.set({ access: 'access-token', refresh: 'refresh-token' })
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((url, options = {}) => {
      if (String(url).endsWith('/profile/')) return json({ id: 9, display_name: 'Aiko', profile_image_url: null, email: 'aiko@example.com' })
      if (String(url).endsWith('/support/') && options.method === 'POST') return json({ ticket_id: 'SUP-20260724-0001', status: 'new' }, 201)
      if (String(url).endsWith('/support/')) return json({
        default_contact_email: 'aiko@example.com',
        categories: [{ value: 'bug_report', label: 'Bug Report' }],
      })
      return json({})
    })
    renderRoute('/contact')
    await screen.findByRole('heading', { name: 'Contact Us' })
    await userEvent.selectOptions(screen.getByLabelText('Category'), 'bug_report')
    await userEvent.type(screen.getByLabelText('Subject'), 'Map is not loading')
    await userEvent.type(screen.getByLabelText('Message'), 'The map remains blank after refreshing.')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('Map is not loading')
    expect(screen.getByRole('dialog')).toHaveTextContent('cannot be edited')
    await userEvent.click(screen.getByRole('button', { name: 'Send Request' }))
    expect(await screen.findByText('SUP-20260724-0001')).toBeInTheDocument()
    const postCall = fetchMock.mock.calls.find(([url, options]) => String(url).endsWith('/support/') && options.method === 'POST')
    expect(postCall[1].body).toBeInstanceOf(FormData)
    expect(postCall[1].body.get('category')).toBe('bug_report')
  })

  it('registers without logging in and shows the check-email page', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      if (String(url).endsWith('/auth/register/')) return json({
        message: 'Your account was created. Confirm your email before signing in.',
        masked_email: 'sa****@example.com',
      }, 201)
      return json({})
    })
    renderRoute('/register')
    await userEvent.type(screen.getByLabelText('Username'), 'sakura')
    await userEvent.type(screen.getByLabelText('Email'), 'sakura@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'StrongPass123!')
    await userEvent.type(screen.getByLabelText('Confirm password'), 'StrongPass123!')
    const registrationForm = screen.getByRole('button', { name: 'Register' }).closest('form')
    expect(within(registrationForm).getByRole('link', { name: 'Terms of Use' })).toHaveAttribute('target', '_blank')
    expect(within(registrationForm).getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('rel', 'noopener noreferrer')
    await userEvent.click(screen.getByLabelText(/I agree to the Terms of Use/))
    await userEvent.click(screen.getByRole('button', { name: 'Register' }))
    expect(await screen.findByRole('heading', { name: 'Thank You for Registering' })).toBeInTheDocument()
    expect(screen.getByText(/sa\*\*\*\*@example.com/)).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('/auth/login/'), expect.anything())
    const registerCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/auth/register/'))
    expect(JSON.parse(registerCall[1].body)).toMatchObject({ legal_consent: true })
  })

  it('does not submit registration until legal consent is checked', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() => json({}))
    renderRoute('/register')
    await userEvent.type(screen.getByLabelText('Username'), 'sakura')
    await userEvent.type(screen.getByLabelText('Email'), 'sakura@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'StrongPass123!')
    await userEvent.type(screen.getByLabelText('Confirm password'), 'StrongPass123!')
    await userEvent.click(screen.getByRole('button', { name: 'Register' }))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getByLabelText(/I agree to the Terms of Use/)).not.toBeChecked()
  })

  it('requires all account-deletion confirmations, clears auth, and redirects home', async () => {
    tokenStore.set({ access: 'access-token', refresh: 'refresh-token' })
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      if (String(url).endsWith('/profile/')) return json({ id: 7, display_name: 'Sakura', nickname: 'Sakura', email: 'sakura@example.com', email_verified: true, profile_image_url: null })
      if (String(url).endsWith('/auth/account/verify-password/')) return json({ verified: true })
      if (String(url).endsWith('/auth/account/delete/')) return json({ message: 'Your account has been permanently deleted.' })
      if (String(url).endsWith('/home/')) return json({ stats: {}, latest_places: [], top_places: [], top_prefectures: [], top_regions: [], top_contributors: [] })
      if (String(url).endsWith('/places/trending/')) return json({ results: [] })
      return json({})
    })
    renderRoute('/profile/edit')
    expect(await screen.findByRole('heading', { name: 'Edit profile' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Delete account' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('Nothing will be deleted')
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await userEvent.type(screen.getByLabelText('Current password'), 'StrongPass123!')
    await userEvent.click(screen.getByRole('button', { name: 'Verify password' }))
    expect(await screen.findByText(/Japan47 Community/)).toBeInTheDocument()
    const finalButton = screen.getByRole('button', { name: 'Permanently delete account' })
    expect(finalButton).toBeDisabled()
    await userEvent.type(screen.getByLabelText(/Type "DELETE"/), 'DELETE')
    const enabledFinalButton = screen.getByRole('button', { name: 'Permanently delete account' })
    expect(enabledFinalButton).toBeEnabled()
    await userEvent.click(enabledFinalButton)
    expect(await screen.findByRole('heading', { name: /Discover Japan/ })).toBeInTheDocument()
    expect(screen.getByText('Your account has been permanently deleted.')).toBeInTheDocument()
    expect(tokenStore.get()).toBeNull()
    const deleteCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/auth/account/delete/'))
    expect(JSON.parse(deleteCall[1].body)).toEqual({ password: 'StrongPass123!', confirmation: 'DELETE' })
  })

  it('shows a resend action when valid credentials belong to an unverified account', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      if (String(url).endsWith('/auth/login/')) return json({
        error: { code: 'EMAIL_NOT_VERIFIED', message: 'Confirm your email address before signing in.' },
      }, 401)
      return json({})
    })
    renderRoute('/login')
    await userEvent.type(screen.getByLabelText('Username'), 'sakura')
    await userEvent.type(screen.getByLabelText('Password'), 'StrongPass123!')
    await userEvent.click(screen.getByRole('button', { name: 'Login' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Confirm your email address')
    expect(screen.getByRole('link', { name: 'Resend Verification Email' })).toHaveAttribute('href', '/check-email')
  })

  it('renders verification success from the backend result', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => json({ result: 'success', message: 'Email Confirmed Successfully' }))
    renderRoute('/verify-email/signed-token')
    expect(await screen.findByRole('heading', { name: 'Email Confirmed Successfully' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign In' })).toHaveAttribute('href', '/login')
  })

  it('submits password recovery and completes a reset without displaying the token', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      if (String(url).endsWith('/auth/password-reset/request/')) return json({ message: 'If an account exists for that email address, we have sent password-reset instructions.' })
      if (String(url).endsWith('/auth/password-reset/confirm/')) return json({ result: 'success', message: 'Password Changed Successfully' })
      return json({})
    })
    const forgot = renderRoute('/forgot-password')
    await userEvent.type(screen.getByLabelText('Email address'), 'sakura@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Send Reset Instructions' }))
    expect(await screen.findByRole('status')).toHaveTextContent('If an account exists')
    forgot.unmount()

    renderRoute('/reset-password/dWlk/reset-secret-token')
    expect(screen.queryByDisplayValue('reset-secret-token')).not.toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('New Password'), 'NewStrongPass456!')
    await userEvent.type(screen.getByLabelText('Confirm New Password'), 'NewStrongPass456!')
    await userEvent.click(screen.getByRole('button', { name: 'Change Password' }))
    expect(await screen.findByRole('heading', { name: 'Password Changed Successfully' })).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/auth/password-reset/confirm/'), expect.objectContaining({ method: 'POST' }))
  })

  it('displays password-validator errors beside the reset password field', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => json({
      error: {
        code: 'validation_error',
        message: 'Please correct the highlighted fields.',
        fields: { new_password: ['This password is too common.'] },
      },
    }, 400))
    renderRoute('/reset-password/dWlk/reset-token')
    await userEvent.type(screen.getByLabelText('New Password'), 'password')
    await userEvent.type(screen.getByLabelText('Confirm New Password'), 'password')
    await userEvent.click(screen.getByRole('button', { name: 'Change Password' }))
    expect(await screen.findByText('This password is too common.')).toBeInTheDocument()
  })
})
