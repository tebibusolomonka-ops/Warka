import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { OperationsResponseWorkspace } from './OperationsResponseWorkspace.js'

const alert = {
  id: 'alert-database',
  policy: 'database-availability',
  severity: 'critical' as const,
  state: 'open' as const,
  occurrenceCount: 2,
}

describe('Operations response workspace', () => {
  it('lets an operator acknowledge and declare without presenting acknowledgement as recovery', async () => {
    const acknowledge = vi.fn(async () => undefined)
    const declare = vi.fn(async () => undefined)
    render(
      <OperationsResponseWorkspace
        authorized
        alerts={[alert]}
        incidents={[]}
        onAcknowledge={acknowledge}
        onDeclareIncident={declare}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Acknowledge alert' }))
    expect(acknowledge).toHaveBeenCalledWith(alert.id)
    expect(screen.getByText(/critical open/)).toBeTruthy()
  })

  it('does not expose controls to school roles', () => {
    const { container } = render(
      <OperationsResponseWorkspace
        authorized={false}
        alerts={[alert]}
        incidents={[]}
        onAcknowledge={vi.fn()}
        onDeclareIncident={vi.fn()}
      />,
    )
    expect(container.childElementCount).toBe(0)
  })
})
