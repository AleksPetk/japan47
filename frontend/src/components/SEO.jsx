import { useEffect } from 'react'
import { absolutePublicUrl, DEFAULT_SOCIAL_IMAGE, SITE_URL, summarize } from '../utils/seo'

function setMeta(attribute, key, content) {
  let element = document.head.querySelector(`meta[${attribute}="${key}"]`)
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, key)
    document.head.appendChild(element)
  }
  element.setAttribute('content', String(content))
}

function setCanonical(href) {
  let element = document.head.querySelector('link[rel="canonical"]')
  if (!element) {
    element = document.createElement('link')
    element.setAttribute('rel', 'canonical')
    document.head.appendChild(element)
  }
  element.setAttribute('href', href)
}

function setJsonLd(id, serializedData) {
  let element = document.head.querySelector(`script[data-jsonld="${id}"]`)

  if (!serializedData) {
    element?.remove()
    return
  }

  if (!element) {
    element = document.createElement('script')
    element.type = 'application/ld+json'
    element.dataset.jsonld = id
    document.head.appendChild(element)
  }

  element.textContent = serializedData.replace(/</g, '\\u003c')
}

function schemaLabel(segment) {
  return decodeURIComponent(segment)
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function breadcrumbSchema(canonicalUrl, title) {
  const url = new URL(canonicalUrl)
  const segments = url.pathname.split('/').filter(Boolean)
  const items = [{
    '@type': 'ListItem',
    position: 1,
    name: 'Home',
    item: `${SITE_URL}/`,
  }]
  let path = ''

  segments.forEach((segment, index) => {
    path += `/${segment}`
    // Place URLs contain an internal numeric ID before the public slug. It is
    // part of the URL but not a useful breadcrumb for visitors or crawlers.
    if (segments[0] === 'places' && index === 1 && /^\d+$/.test(segment) && index < segments.length - 1) return
    const isCurrentPage = index === segments.length - 1
    items.push({
      '@type': 'ListItem',
      position: items.length + 1,
      name: isCurrentPage ? title.split('|')[0].trim() : schemaLabel(segment),
      item: isCurrentPage ? canonicalUrl : `${url.origin}${path}`,
    })
  })

  return {
    '@type': 'BreadcrumbList',
    '@id': `${canonicalUrl}#breadcrumb`,
    itemListElement: items,
  }
}

function pageSpecificSchemas(structuredData) {
  if (!structuredData) return []
  if (Array.isArray(structuredData)) return structuredData
  if (Array.isArray(structuredData['@graph'])) return structuredData['@graph']
  const schema = { ...structuredData }
  delete schema['@context']
  return [schema]
}

function automaticStructuredData({ canonicalUrl, description, title, structuredData }) {
  const organizationId = `${SITE_URL}/#organization`
  const websiteId = `${SITE_URL}/#website`
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': organizationId,
        name: 'Japan47',
        url: `${SITE_URL}/`,
        logo: {
          '@type': 'ImageObject',
          url: `${SITE_URL}/logo.PNG`,
        },
      },
      {
        '@type': 'WebSite',
        '@id': websiteId,
        name: 'Japan47',
        url: `${SITE_URL}/`,
        description,
        publisher: { '@id': organizationId },
        potentialAction: {
          '@type': 'SearchAction',
          target: `${SITE_URL}/search?q={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      },
      breadcrumbSchema(canonicalUrl, title),
      ...pageSpecificSchemas(structuredData),
    ],
  }
}

export default function SEO({
  title = 'Japan47 — Discover Every Prefecture in Japan',
  description = 'Explore destinations and community travel guides across all 47 prefectures of Japan.',
  canonicalPath = '/',
  canonicalUrl,
  robots = 'index, follow',
  type = 'website',
  image = DEFAULT_SOCIAL_IMAGE,
  imageWidth = 1200,
  imageHeight = 630,
  imageType = 'image/jpeg',
  structuredData = null,
}) {
  const resolvedDescription = summarize(description)
  const resolvedCanonical = absolutePublicUrl(canonicalUrl || canonicalPath)
  const resolvedImage = absolutePublicUrl(image)
  const schemaData = automaticStructuredData({
    canonicalUrl: resolvedCanonical,
    description: resolvedDescription,
    title,
    structuredData,
  })
  const serializedSchemaData = JSON.stringify(schemaData)

  useEffect(() => {
    document.title = title
    setCanonical(resolvedCanonical)
    setMeta('name', 'description', resolvedDescription)
    setMeta('name', 'robots', robots)
    setMeta('property', 'og:site_name', 'Japan47')
    setMeta('property', 'og:title', title)
    setMeta('property', 'og:description', resolvedDescription)
    setMeta('property', 'og:url', resolvedCanonical)
    setMeta('property', 'og:type', type)
    setMeta('property', 'og:image', resolvedImage)
    setMeta('property', 'og:image:width', imageWidth)
    setMeta('property', 'og:image:height', imageHeight)
    setMeta('property', 'og:image:type', imageType)
    setMeta('name', 'twitter:card', 'summary_large_image')
    setMeta('name', 'twitter:title', title)
    setMeta('name', 'twitter:description', resolvedDescription)
    setMeta('name', 'twitter:image', resolvedImage)
    setJsonLd('structured-data', serializedSchemaData)
  }, [imageHeight, imageType, imageWidth, resolvedCanonical, resolvedDescription, resolvedImage, robots, serializedSchemaData, title, type])

  return null
}
