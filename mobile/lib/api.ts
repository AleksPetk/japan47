import { apiBaseUrl } from './config';
import { AuthTokens, tokenStorage } from './storage';
import type { FieldErrors } from '@/types/api';

type RequestOptions = RequestInit & { authenticated?: boolean };

export class ApiError extends Error {
  status: number;
  code?: string;
  fields: FieldErrors;

  constructor(status: number, payload: any) {
    super(payload?.error?.message || 'The request could not be completed.');
    this.name = 'ApiError';
    this.status = status;
    this.code = payload?.error?.code;
    this.fields = payload?.error?.fields || {};
  }
}

let refreshPromise: Promise<string | null> | null = null;

async function parseResponse(response: Response) {
  if (response.status === 204) return null;
  const contentType = response.headers.get('content-type') || '';
  return contentType.includes('json') ? response.json() : null;
}

async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const tokens = await tokenStorage.get();
    if (!tokens?.refresh) return null;
    const response = await fetch(`${apiBaseUrl}/auth/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: tokens.refresh }),
    });
    const payload = await parseResponse(response);
    if (!response.ok) {
      await tokenStorage.clear();
      return null;
    }
    const next: AuthTokens = { access: payload.access, refresh: payload.refresh || tokens.refresh };
    await tokenStorage.set(next);
    return next.access;
  })().finally(() => { refreshPromise = null; });
  return refreshPromise;
}

export async function api<T = any>(path: string, options: RequestOptions = {}, retry = true): Promise<T> {
  const headers = new Headers(options.headers || {});
  const authenticated = options.authenticated !== false;
  const tokens = authenticated ? await tokenStorage.get() : null;
  if (tokens?.access) headers.set('Authorization', `Bearer ${tokens.access}`);
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const url = path.startsWith('http') ? path : `${apiBaseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
  const response = await fetch(url, { ...options, headers });
  if (response.status === 401 && retry && authenticated && tokens?.refresh) {
    const access = await refreshAccessToken();
    if (access) return api<T>(path, options, false);
  }
  const payload = await parseResponse(response);
  if (!response.ok) throw new ApiError(response.status, payload);
  return payload as T;
}

export const jsonBody = (value: unknown) => JSON.stringify(value);

export function firstFieldError(error: unknown, field?: string) {
  if (!(error instanceof ApiError)) return error instanceof Error ? error.message : 'Something went wrong.';
  const value = field ? error.fields[field] : undefined;
  if (Array.isArray(value)) return value[0];
  return value || error.message;
}
