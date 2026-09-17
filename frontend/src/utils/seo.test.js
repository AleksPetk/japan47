import { describe, expect, it } from 'vitest'
import {
  buildContributorMetadata,
  getRouteMetadata,
  normalizeCanonicalPath,
} from './seo'

describe('seo helpers', () => {
  it('normalizes trailing slashes for canonical paths', () => {
    expect(normalizeCanonicalPath('/')).toBe('/')
    expect(normalizeCanonicalPath('/prefectures/')).toBe('/prefectures')
    expect(normalizeCanonicalPath('/prefectures')).toBe('/prefectures')
  })

  it('marks the contributors directory as noindex', () => {
    expect(getRouteMetadata('/contributors')).toMatchObject({
      canonicalPath: '/contributors',
      robots: 'noindex, follow',
    })
    expect(getRouteMetadata('/contributors/')).toMatchObject({
      canonicalPath: '/contributors',
      robots: 'noindex, follow',
    })
  })

  it('builds unique contributor metadata and noindexes empty profiles', () => {
    const active = buildContributorMetadata({
      id: 81,
      display_name: 'Kenta',
      stats: { published_place_count: 0, review_count: 3 },
      places: [],
      reviews: [{ id: 1 }, { id: 2 }, { id: 3 }],
    })
    expect(active).toMatchObject({
      title: 'Kenta — Japan47 Contributor',
      canonicalPath: '/contributors/81',
      robots: 'index, follow',
    })
    expect(active.description).toContain('Kenta')
    expect(active.description).toContain('3 reviews')

    const empty = buildContributorMetadata({
      id: 99,
      display_name: 'New Traveler',
      stats: { published_place_count: 0, review_count: 0 },
      places: [],
      reviews: [],
    })
    expect(empty.robots).toBe('noindex, follow')
    expect(empty.title).toBe('New Traveler — Japan47 Contributor')
  })
})
