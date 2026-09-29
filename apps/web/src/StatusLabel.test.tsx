import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { StatusLabel } from './StatusLabel'

it('shows status as visible text even without color styling', () => {
  render(<StatusLabel status="pending" context="Enrollment" />)
  expect(screen.getByText('Enrollment: pending').textContent).toBe(
    'Enrollment: pending',
  )
})
