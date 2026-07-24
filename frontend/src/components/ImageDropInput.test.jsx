import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'

import ImageDropInput from './ImageDropInput'

it('passes dropped gallery files to the form', () => {
  const onFiles = vi.fn()
  const file = new File(['image'], 'tokyo.png', { type: 'image/png' })
  render(<ImageDropInput id="gallery" multiple onFiles={onFiles} />)
  fireEvent.drop(screen.getByText(/choose images/i).parentElement, {
    dataTransfer: { files: [file] },
  })
  expect(onFiles).toHaveBeenCalledWith([file])
})
