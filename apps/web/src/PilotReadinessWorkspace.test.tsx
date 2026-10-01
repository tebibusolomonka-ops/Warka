import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  PilotReadinessWorkspace,
  type PilotSchool,
} from './PilotReadinessWorkspace.js'

const school: PilotSchool = {
  id: 'school-synthetic',
  name: 'Warka Test School',
  status: 'ready',
  missing: [],
  trainingState: 'complete',
  dataPreparationState: 'complete',
  supportCoverage: 'confirmed',
  goLiveWindow: '2099-01-01',
  history: [{ to: 'ready', at: '2098-12-01' }],
}

describe('pilot readiness workspace', () => {
  it('shows factual readiness and requires explicit activation', () => {
    const transition = vi.fn()
    render(
      <PilotReadinessWorkspace
        authorized
        schools={[school]}
        onTransition={transition}
      />,
    )
    expect(screen.getByText('State: ready')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Activate pilot' }))
    expect(transition).toHaveBeenCalledWith(school.id, 'active')
    expect(screen.getByText(/ready at/)).toBeTruthy()
  })

  it('hides rollout controls from school roles', () => {
    const { container } = render(
      <PilotReadinessWorkspace
        authorized={false}
        schools={[school]}
        onTransition={vi.fn()}
      />,
    )
    expect(container.childElementCount).toBe(0)
  })
})
