import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PREFECTURES, REGIONS } from '../src/data/geography.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const distDir = resolve(root, 'dist')
const templatePath = resolve(distDir, 'index.html')

const origin = (process.env.VITE_PUBLIC_URL || 'https://japan47.alekspetk.com').replace(/\/$/, '')

/** List-page metadata aligned with frontend/src/utils/seo.js routeMetadata. */
const listRouteMeta = {
  '/': {
    title: 'Japan47 — Discover Every Prefecture in Japan',
    description: 'Explore destinations, regional guides, and community recommendations across all 47 prefectures of Japan.',
  },
  '/regions': {
    title: 'Regions of Japan — Regional Travel Guides | Japan47',
    description: 'Discover the landscapes, culture, destinations, and prefectures of Japan’s nine distinct regions.',
  },
  '/prefectures': {
    title: 'Japan’s 47 Prefectures — Complete Travel Guide | Japan47',
    description: 'Browse all 47 Japanese prefectures and find community-rated destinations, regional highlights, and travel inspiration.',
  },
  '/places': {
    title: 'Places to Visit in Japan — Community Travel Guide | Japan47',
    description: 'Find places to visit across Japan, with traveler reviews, ratings, local tips, and community recommendations.',
  },
  '/privacy': {
    title: 'Privacy Policy | Japan47',
    description: 'Japan 47 uses account and contribution data to operate the travel community. Email addresses are private, public contributions are visible to others, and we do not sell personal information.',
  },
  '/terms': {
    title: 'Terms of Use | Japan47',
    description: 'These Terms govern access to Japan 47, including accounts, place submissions, images, ratings, reviews, profiles, and contributor features.',
  },
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function absoluteUrl(path) {
  if (path === '/') return `${origin}/`
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`
}

function replaceMetaName(html, name, content) {
  const pattern = new RegExp(`(<meta\\s+name="${name}"\\s+content=")[^"]*(")`, 'i')
  if (!pattern.test(html)) {
    throw new Error(`Missing meta name="${name}" in built index.html`)
  }
  return html.replace(pattern, `$1${escapeHtml(content)}$2`)
}

function replaceMetaProperty(html, property, content) {
  const pattern = new RegExp(`(<meta\\s+property="${property}"\\s+content=")[^"]*(")`, 'i')
  if (!pattern.test(html)) {
    throw new Error(`Missing meta property="${property}" in built index.html`)
  }
  return html.replace(pattern, `$1${escapeHtml(content)}$2`)
}

function applyHead(html, { title, description, canonicalPath }) {
  const canonical = absoluteUrl(canonicalPath)
  let next = html
  next = next.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(title)}</title>`)
  next = replaceMetaName(next, 'description', description)
  next = replaceMetaProperty(next, 'og:title', title)
  next = replaceMetaProperty(next, 'og:description', description)
  next = replaceMetaProperty(next, 'og:url', canonical)
  next = replaceMetaName(next, 'twitter:title', title)
  next = replaceMetaName(next, 'twitter:description', description)
  next = next.replace(
    /(<link\s+rel="canonical"\s+href=")[^"]*(")/i,
    `$1${escapeHtml(canonical)}$2`,
  )
  return next
}

function injectRoot(html, bodyInner) {
  if (!/<div id="root">\s*<\/div>/i.test(html)) {
    throw new Error('Could not find empty #root in built index.html')
  }
  return html.replace(/<div id="root">\s*<\/div>/i, `<div id="root">${bodyInner}</div>`)
}

function writePage(canonicalPath, html) {
  const outputPath = canonicalPath === '/'
    ? resolve(distDir, 'index.html')
    : resolve(distDir, canonicalPath.replace(/^\//, ''), 'index.html')
  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, html)
  return outputPath
}

function linkList(items) {
  return `<ul>${items.map((item) => `<li><a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a></li>`).join('')}</ul>`
}

function buildPages() {
  const regionLinks = REGIONS.map((region) => ({
    href: `/regions/${region.name}`,
    label: region.label,
  }))
  const prefectureLinks = PREFECTURES.map((prefecture) => ({
    href: `/prefectures/${encodeURIComponent(prefecture.name)}`,
    label: prefecture.name,
  }))

  const pages = [
    {
      path: '/',
      ...listRouteMeta['/'],
      body: `
        <main>
          <p>日本を旅する</p>
          <h1>Discover Japan, one region at a time.</h1>
          <p>Wander from quiet mountain towns to lantern-lit streets and discover the distinct beauty of Japan’s regions and prefectures.</p>
          <p><a href="/regions">Explore the regions</a> · <a href="/prefectures">Browse all 47 prefectures</a> · <a href="/places">Places to discover</a></p>
          <h2>Regions of Japan</h2>
          ${linkList(regionLinks)}
        </main>
      `,
    },
    {
      path: '/regions',
      ...listRouteMeta['/regions'],
      body: `
        <main>
          <p>Explore Japan</p>
          <h1>Regions of Japan</h1>
          <p>Discover the character, landscapes, and prefectures of every region across the archipelago.</p>
          <h2>Nine distinct regions</h2>
          ${linkList(regionLinks)}
        </main>
      `,
    },
    {
      path: '/prefectures',
      ...listRouteMeta['/prefectures'],
      body: `
        <main>
          <p>Forty-seven stories</p>
          <h1>Japan’s prefectures</h1>
          <p>Search and compare every prefecture by region, rating, and community contributions.</p>
          <h2>Prefectures to explore</h2>
          ${linkList(prefectureLinks)}
        </main>
      `,
    },
    {
      path: '/places',
      ...listRouteMeta['/places'],
      body: `
        <main>
          <p>Community guide</p>
          <h1>Places to discover</h1>
          <p>Browse destinations shared by Japan 47 contributors.</p>
          <p>Filter places by region and prefecture, or explore Japan’s geography first.</p>
          <p><a href="/regions">Regions of Japan</a> · <a href="/prefectures">Japan’s prefectures</a></p>
        </main>
      `,
    },
    {
      path: '/privacy',
      ...listRouteMeta['/privacy'],
      body: `
        <main>
          <p>Japan 47 information</p>
          <h1>Privacy Policy</h1>
          <p>Effective and last updated: July 26, 2026</p>
          <p><strong>Plain-language summary</strong></p>
          <p>${escapeHtml(listRouteMeta['/privacy'].description)}</p>
          <p><a href="/">Back to home</a></p>
        </main>
      `,
    },
    {
      path: '/terms',
      ...listRouteMeta['/terms'],
      body: `
        <main>
          <p>Japan 47 information</p>
          <h1>Terms of Use</h1>
          <p>Effective and last updated: July 28, 2026</p>
          <p><strong>Please read these Terms</strong></p>
          <p>${escapeHtml(listRouteMeta['/terms'].description)}</p>
          <p><a href="/">Back to home</a></p>
        </main>
      `,
    },
  ]

  for (const region of REGIONS) {
    const prefecturesInRegion = PREFECTURES.filter((item) => item.regionName === region.name)
    const description = `Discover the prefectures, places, and distinctive character of Japan’s ${region.label} region.`
    pages.push({
      path: `/regions/${region.name}`,
      title: `${region.label} Region Travel Guide | Japan47`,
      description,
      body: `
        <main>
          <p><a href="/regions">Regions</a> / ${escapeHtml(region.label)}</p>
          <p>Region of Japan</p>
          <h1>${escapeHtml(region.label)}</h1>
          <p>${escapeHtml(description)}</p>
          <h2>Prefectures in ${escapeHtml(region.label)}</h2>
          ${linkList(prefecturesInRegion.map((item) => ({
            href: `/prefectures/${encodeURIComponent(item.name)}`,
            label: item.name,
          })))}
        </main>
      `,
    })
  }

  for (const prefecture of PREFECTURES) {
    const description = `Discover places to visit, traveler recommendations, and local highlights across ${prefecture.name} Prefecture, Japan.`
    pages.push({
      path: `/prefectures/${encodeURIComponent(prefecture.name)}`,
      title: `${prefecture.name} Prefecture Travel Guide | Japan47`,
      description,
      body: `
        <main>
          <p><a href="/regions">Regions</a> / <a href="/regions/${escapeHtml(prefecture.regionName)}">${escapeHtml(prefecture.regionLabel)}</a> / ${escapeHtml(prefecture.name)}</p>
          <p>${escapeHtml(prefecture.regionLabel)} region</p>
          <h1>${escapeHtml(prefecture.name)}</h1>
          <p>${escapeHtml(description)}</p>
          <p><a href="/places?prefecture=${encodeURIComponent(prefecture.name)}">Explore places</a> in ${escapeHtml(prefecture.name)} Prefecture.</p>
        </main>
      `,
    })
  }

  return pages
}

function prerender() {
  const template = readFileSync(templatePath, 'utf8')
  const pages = buildPages()
  const written = []

  for (const page of pages) {
    let html = applyHead(template, {
      title: page.title,
      description: page.description,
      canonicalPath: page.path,
    })
    html = injectRoot(html, page.body.trim())
    written.push(writePage(page.path, html))
  }

  console.log(`Prerendered ${written.length} HTML pages for ${origin}`)
}

prerender()
