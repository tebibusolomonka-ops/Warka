import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { AsyncStatus } from './AsyncStatus'

it('uses polite status for normal completion and assertive alert for urgent errors', () => {
  const { rerender } = render(<AsyncStatus message="Draft saved." />)
  expect(screen.getByRole('status').getAttribute('aria-live')).toBe('polite')
  rerender(<AsyncStatus message="Upload blocked." urgent />)
  expect(screen.getByRole('alert').getAttribute('aria-live')).toBe('assertive')
})
