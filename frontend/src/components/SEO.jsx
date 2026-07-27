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
}) {
  const resolvedDescription = summarize(description)
  const resolvedCanonical = absolutePublicUrl(canonicalUrl || canonicalPath)
  const resolvedImage = absolutePublicUrl(image)

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
  }, [imageHeight, imageType, imageWidth, resolvedCanonical, resolvedDescription, resolvedImage, robots, title, type])

  return null
}
