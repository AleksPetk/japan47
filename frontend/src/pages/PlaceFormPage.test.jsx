import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PlaceFormPage from './PlaceFormPage'

const apiMock = vi.hoisted(() => vi.fn())
const fixture = vi.hoisted(() => ({
  prefectures: [{ id: 2, name: 'Aomori', region: { label: 'Tohoku' } }],
  place: {
    id: 12,
    slug: 'lake-towada',
    name: 'Approved lake name',
    description: 'Approved description',
    city: '',
    google_maps_url: '',
    official_website: '',
    travel_tips: '',
    best_season: 'autumn',
    latitude: null,
    longitude: null,
    prefecture: { id: 2 },
    image_url: 'https://example.test/media/approved-main.jpg',
    gallery_images: [
      { id: 31, image_url: 'https://example.test/media/approved-gallery.jpg', thumbnail_url: null, caption: 'Approved gallery' },
    ],
    latest_revision: {
      status: 'pending',
      name: 'Proposed lake name',
      description: 'Proposed description',
      city: 'Towada',
      google_maps_url: '',
      official_website: '',
      travel_tips: 'Visit early.',
      best_season: 'autumn',
      latitude: null,
      longitude: null,
      prefecture: { id: 2 },
      image_url: null,
      remove_image: false,
      removed_gallery_image_ids: [],
      gallery_images: [
        { id: 41, image_url: 'https://example.test/media/proposed-gallery.jpg', thumbnail_url: null, caption: 'Proposed gallery' },
      ],
    },
  },
}))

vi.mock('../api/client', () => ({ api: apiMock }))
vi.mock('../hooks/useApi', () => ({
  useApi: (path) => path === '/prefectures/'
    ? { data: fixture.prefectures, loading: false, error: null }
    : { data: fixture.place, loading: false, error: null },
}))

beforeEach(() => {
  apiMock.mockReset()
  apiMock.mockResolvedValue({ id: 12, slug: 'lake-towada' })
})

describe('PlaceFormPage revision editing', () => {
  it('loads and updates the pending proposal instead of replacing approved values', async () => {
    render(<MemoryRouter initialEntries={['/places/12/edit']}><Routes><Route path="/places/:id/edit" element={<PlaceFormPage />} /><Route path="/places/:id/:slug" element={<div>Place detail</div>} /></Routes></MemoryRouter>)

    expect(await screen.findByDisplayValue('Proposed lake name')).toBeInTheDocument()
    expect(screen.getByText(/approved place stays public/)).toBeInTheDocument()
    await userEvent.clear(screen.getByLabelText('Place name'))
    await userEvent.type(screen.getByLabelText('Place name'), 'Updated proposal')
    await userEvent.click(screen.getByRole('button', { name: 'Update pending changes' }))

    await waitFor(() => expect(apiMock).toHaveBeenCalled())
    const [path, options] = apiMock.mock.calls[0]
    expect(path).toBe('/places/12/')
    expect(options.method).toBe('PATCH')
    expect(options.body).toBeInstanceOf(FormData)
    expect(options.body.get('name')).toBe('Updated proposal')
  })

  it('shows existing images and submits explicit main and gallery removals', async () => {
    render(<MemoryRouter initialEntries={['/places/12/edit']}><Routes><Route path="/places/:id/edit" element={<PlaceFormPage />} /><Route path="/places/:id/:slug" element={<div>Place detail</div>} /></Routes></MemoryRouter>)

    expect(await screen.findByAltText('Approved lake name current main')).toBeInTheDocument()
    expect(screen.getByAltText('Approved gallery')).toBeInTheDocument()
    expect(screen.getByAltText('Proposed gallery')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Remove image' }))
    await userEvent.click(screen.getByAltText('Approved gallery').closest('article').querySelector('button'))
    await userEvent.click(screen.getByAltText('Proposed gallery').closest('article').querySelector('button'))
    await userEvent.click(screen.getByRole('button', { name: 'Update pending changes' }))

    await waitFor(() => expect(apiMock).toHaveBeenCalledTimes(3))
    const patchBody = apiMock.mock.calls[0][1].body
    expect(patchBody.get('remove_image')).toBe('true')
    expect(apiMock).toHaveBeenNthCalledWith(2, '/places/12/images/31/', { method: 'DELETE' })
    expect(apiMock).toHaveBeenNthCalledWith(3, '/places/12/revision-images/41/', { method: 'DELETE' })
  })
})
