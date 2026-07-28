export const SITE_URL = (import.meta.env.VITE_PUBLIC_URL || 'https://japan47.alekspetk.com').replace(/\/$/, '')
export const DEFAULT_SOCIAL_IMAGE = `${SITE_URL}/images/japan47-og.jpg`

const routeMetadata = {
  '/': {
    title: 'Japan47 — Discover Every Prefecture in Japan',
    description: 'Explore destinations, regional guides, and community recommendations across all 47 prefectures of Japan.',
    canonicalPath: '/',
  },
  '/regions': {
    title: 'Regions of Japan — Regional Travel Guides | Japan47',
    description: 'Discover the landscapes, culture, destinations, and prefectures of Japan’s nine distinct regions.',
    canonicalPath: '/regions',
  },
  '/prefectures': {
    title: 'Japan’s 47 Prefectures — Complete Travel Guide | Japan47',
    description: 'Browse all 47 Japanese prefectures and find community-rated destinations, regional highlights, and travel inspiration.',
    canonicalPath: '/prefectures',
  },
  '/places': {
    title: 'Places to Visit in Japan — Community Travel Guide | Japan47',
    description: 'Find places to visit across Japan, with traveler reviews, ratings, local tips, and community recommendations.',
    canonicalPath: '/places',
  },
  '/support': {
    title: 'Support Japan47 — Help Keep the Community Project Running',
    description: 'Learn how optional support helps cover Japan47 hosting, maintenance, image storage, and future web and mobile development.',
    canonicalPath: '/support',
  },
}

const sectionLabels = {
  search: 'Search',
  contributors: 'Contributor',
  'my-travel': 'My Travel',
  contact: 'Contact',
  support: 'Support Japan47',
  login: 'Login',
  register: 'Register',
  'check-email': 'Check Your Email',
  'verify-email': 'Verify Email',
  'forgot-password': 'Forgot Password',
  'reset-password': 'Reset Password',
  privacy: 'Privacy Policy',
  terms: 'Terms of Use',
}

const privateSections = new Set([
  'profile', 'my-travel', 'contact', 'login', 'register', 'check-email',
  'verify-email', 'forgot-password', 'reset-password', 'password-reset-success',
])

export function getRouteMetadata(pathname) {
  if (routeMetadata[pathname]) return routeMetadata[pathname]

  const [section] = pathname.split('/').filter(Boolean)
  const label = sectionLabels[section] || 'Japan Travel Guide'
  return {
    title: `${label} | Japan47`,
    description: `Explore Japan47 ${label.toLowerCase()} travel information and community recommendations.`,
    canonicalPath: pathname,
    robots: privateSections.has(section) ? 'noindex, nofollow' : 'index, follow',
  }
}

export function summarize(value, fallback, limit = 160) {
  const text = String(value || fallback || '').replace(/\s+/g, ' ').trim()
  if (text.length <= limit) return text
  return `${text.slice(0, limit - 1).trimEnd()}…`
}

export function absolutePublicUrl(value) {
  if (!value) return DEFAULT_SOCIAL_IMAGE
  try {
    return new URL(value, `${SITE_URL}/`).href
  } catch {
    return DEFAULT_SOCIAL_IMAGE
  }
}

export function imageContentType(value) {
  const pathname = (() => {
    try { return new URL(value, `${SITE_URL}/`).pathname.toLowerCase() } catch { return '' }
  })()
  if (pathname.endsWith('.png')) return 'image/png'
  if (pathname.endsWith('.webp')) return 'image/webp'
  if (pathname.endsWith('.gif')) return 'image/gif'
  return 'image/jpeg'
}
