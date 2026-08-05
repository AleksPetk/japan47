import { absolutePublicUrl } from '../../utils/seo'

/** Build JSON-LD TouristAttraction data for place detail SEO. */
export function buildAttractionSchema(data, { description, canonicalUrl, socialImage }) {
  return {
    '@type': 'TouristAttraction',
    '@id': `${canonicalUrl}#attraction`,
    name: data.name,
    description,
    url: canonicalUrl,
    image: absolutePublicUrl(socialImage),
    mainEntityOfPage: canonicalUrl,
    address: {
      '@type': 'PostalAddress',
      addressLocality: data.city || undefined,
      addressRegion: data.prefecture.name,
      addressCountry: 'JP',
    },
    geo:
      data.latitude != null && data.longitude != null
        ? {
            '@type': 'GeoCoordinates',
            latitude: data.latitude,
            longitude: data.longitude,
          }
        : undefined,
    aggregateRating:
      data.average_rating && data.review_count
        ? {
            '@type': 'AggregateRating',
            ratingValue: data.average_rating,
            reviewCount: data.review_count,
            bestRating: 5,
            worstRating: 1,
          }
        : undefined,
    sameAs: data.official_website || undefined,
  }
}
