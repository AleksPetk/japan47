import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PlaceDetailPage from './PlaceDetailPage'

const apiMock = vi.hoisted(() => vi.fn())

vi.mock('../api/client', () => ({ api: apiMock }))
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 7 } }) }))
vi.mock('../hooks/useApi', () => ({
  useApi: () => ({
    loading: false,
    error: null,
    data: {
      id: 12,
      name: 'Lake Towada',
      slug: 'lake-towada',
      description: 'A scenic caldera lake.',
      image_url: null,
      city: '',
      best_season: 'autumn',
      status: 'published',
      created_at: '2026-07-20T10:00:00Z',
      average_rating: null,
      review_count: 0,
      rating_distribution: {},
      prefecture: { id: 2, name: 'Aomori', region: { label: 'Tohoku' } },
      author: { id: 7, display_name: 'Hana' },
      can_edit: true,
      is_favorite: false,
      is_visited: true,
      latest_revision: { status: 'pending', review_note: '' },
      deletion_request: null,
      gallery_images: [],
      reviews: [],
      related_places: [],
      nearby_places: [],
      google_maps_url: '',
      official_website: '',
      travel_tips: '',
    },
  }),
}))

beforeEach(() => {
  apiMock.mockReset()
  apiMock.mockResolvedValue({})
})

describe('PlaceDetailPage viewer state', () => {
  it('immediately unmarks and remarks a visited place with the correct methods', async () => {
    render(<MemoryRouter initialEntries={['/places/12/lake-towada']}><Routes><Route path="/places/:id/:slug" element={<PlaceDetailPage />} /></Routes></MemoryRouter>)

    expect(screen.getByText(/approved version/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Visited ✓' }))
    expect(apiMock).toHaveBeenLastCalledWith('/places/12/visited/', { method: 'DELETE' })
    expect(screen.getByRole('button', { name: 'Mark visited' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Mark visited' }))
    expect(apiMock).toHaveBeenLastCalledWith('/places/12/visited/', { method: 'POST' })
    expect(screen.getByRole('button', { name: 'Visited ✓' })).toBeInTheDocument()
  })

  it('submits an owner deletion reason for admin review instead of deleting directly', async () => {
    apiMock.mockResolvedValueOnce({
      deletion_request: { id: 4, status: 'pending', reason: 'This listing is no longer valid.', admin_note: '' },
    })
    render(<MemoryRouter initialEntries={['/places/12/lake-towada']}><Routes><Route path="/places/:id/:slug" element={<PlaceDetailPage />} /></Routes></MemoryRouter>)

    await userEvent.click(screen.getByRole('button', { name: 'Request deletion' }))
    await userEvent.type(screen.getByLabelText('Why should this place be deleted?'), 'This listing is no longer valid.')
    await userEvent.click(screen.getByRole('button', { name: 'Send deletion request' }))

    expect(apiMock).toHaveBeenCalledWith('/places/12/deletion-request/', {
      method: 'POST',
      body: JSON.stringify({ reason: 'This listing is no longer valid.' }),
    })
    expect(await screen.findByText(/awaiting administrator review/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Deletion requested' })).toBeDisabled()
  })
})
