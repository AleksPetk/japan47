const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '')
const TOKEN_KEY = 'japan47_tokens'

export class ApiError extends Error {
  constructor(status, payload) {
    super(payload?.error?.message || 'The request could not be completed.')
    this.name = 'ApiError'
    this.status = status
    this.code = payload?.error?.code
    this.fields = payload?.error?.fields || {}
    this.payload = payload
  }
}

export const tokenStore = {
  get: () => { try { return JSON.parse(localStorage.getItem(TOKEN_KEY)) } catch { return null } },
  set: (tokens) => localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens)),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

async function parse(response) {
  if (response.status === 204) return null
  const contentType = response.headers.get('content-type') || ''
  return contentType.includes('json') ? response.json() : null
}

async function refreshAccess() {
  const tokens = tokenStore.get()
  if (!tokens?.refresh) return null
  const response = await fetch(`${API_BASE}/auth/refresh/`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh: tokens.refresh }),
  })
  const data = await parse(response)
  if (!response.ok) { tokenStore.clear(); return null }
  const next = { access: data.access, refresh: data.refresh || tokens.refresh }
  tokenStore.set(next)
  return next.access
}

export async function api(path, options = {}, retry = true) {
  const headers = new Headers(options.headers || {})
  const tokens = tokenStore.get()
  if (tokens?.access) headers.set('Authorization', `Bearer ${tokens.access}`)
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers })
  if (response.status === 401 && retry && tokens?.refresh) {
    const access = await refreshAccess()
    if (access) return api(path, options, false)
  }
  const data = await parse(response)
  if (!response.ok) throw new ApiError(response.status, data)
  return data
}

export const jsonBody = (data) => JSON.stringify(data)
