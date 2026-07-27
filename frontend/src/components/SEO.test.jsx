import { render, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import SEO from './SEO'

describe('SEO', () => {
  it('updates the complete metadata set without creating duplicate canonical tags', async () => {
    const view = render(<SEO
      title="Kanto Region Travel Guide | Japan47"
      description="Explore Kanto."
      canonicalPath="/regions/kanto"
      type="article"
      image="/media/kanto.jpg"
    />)

    await waitFor(() => expect(document.title).toBe('Kanto Region Travel Guide | Japan47'))
    expect(document.querySelector('meta[name="description"]')).toHaveAttribute('content', 'Explore Kanto.')
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'index, follow')
    expect(document.querySelector('meta[property="og:url"]')).toHaveAttribute('content', 'https://japan47.alekspetk.com/regions/kanto')
    expect(document.querySelector('meta[property="og:type"]')).toHaveAttribute('content', 'article')
    expect(document.querySelector('meta[property="og:image"]')).toHaveAttribute('content', 'https://japan47.alekspetk.com/media/kanto.jpg')
    expect(document.querySelector('meta[property="og:image:width"]')).toHaveAttribute('content', '1200')
    expect(document.querySelector('meta[property="og:image:height"]')).toHaveAttribute('content', '630')
    expect(document.querySelector('meta[property="og:image:type"]')).toHaveAttribute('content', 'image/jpeg')
    expect(document.querySelector('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image')
    expect(document.querySelector('meta[name="twitter:title"]')).toHaveAttribute('content', 'Kanto Region Travel Guide | Japan47')
    expect(document.querySelector('meta[name="twitter:description"]')).toHaveAttribute('content', 'Explore Kanto.')
    expect(document.querySelector('meta[name="twitter:image"]')).toHaveAttribute('content', 'https://japan47.alekspetk.com/media/kanto.jpg')
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute('href', 'https://japan47.alekspetk.com/regions/kanto')

    view.rerender(<SEO title="Japan47" canonicalPath="/" />)
    await waitFor(() => expect(document.title).toBe('Japan47'))
    expect(document.querySelectorAll('link[rel="canonical"]')).toHaveLength(1)
    expect(document.querySelector('meta[property="og:image"]')).toHaveAttribute('content', 'https://japan47.alekspetk.com/images/japan47-og.jpg')
  })
})
