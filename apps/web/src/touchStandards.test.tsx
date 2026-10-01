import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'

it('keeps essential action names available without hover', () => {
  render(
    <>
      <button aria-label="Delete record" title="Delete">
        ×
      </button>
      <label>
        <input type="checkbox" /> Select row
      </label>
    </>,
  )
  expect(screen.getByRole('button', { name: 'Delete record' })).toBeTruthy()
  expect(screen.getByRole('checkbox', { name: 'Select row' })).toBeTruthy()
})
