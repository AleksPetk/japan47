const DEFAULT_API_ORIGIN = 'https://japan47.alekspetk.com';

export const publicOrigin = (process.env.EXPO_PUBLIC_SITE_URL || DEFAULT_API_ORIGIN).replace(/\/$/, '');
export const apiBaseUrl = (process.env.EXPO_PUBLIC_API_URL || `${publicOrigin}/api/v1`).replace(/\/$/, '');

export function apiMediaUrl(value?: string | null) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `${publicOrigin}${value.startsWith('/') ? '' : '/'}${value}`;
}
