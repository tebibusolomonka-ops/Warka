import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { ConnectionStatus } from './ConnectionStatus'

it('distinguishes browser offline from server unreachable', () => {
  const retry = vi.fn()
  const { rerender } = render(
    <ConnectionStatus
      state={{ browser: 'offline', server: 'unknown' }}
      onRetry={retry}
    />,
  )
  expect(screen.getByText('Offline')).toBeTruthy()
  fireEvent.click(screen.getByRole('button'))
  expect(retry).toHaveBeenCalled()
  rerender(
    <ConnectionStatus
      state={{ browser: 'online', server: 'unreachable' }}
      onRetry={retry}
    />,
  )
  expect(screen.getByText('Warka service unavailable')).toBeTruthy()
})
