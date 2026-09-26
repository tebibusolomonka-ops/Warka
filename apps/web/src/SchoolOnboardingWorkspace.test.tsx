import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { SchoolOnboardingWorkspace } from './SchoolOnboardingWorkspace'
import {
  getOnboarding,
  getChecklist,
  getReadiness,
  getContacts,
  getTraining,
  startOnboarding,
  updateChecklist,
} from './onboardingApi'

vi.mock('./onboardingApi', () => ({
  getOnboarding: vi.fn(),
  getChecklist: vi.fn(),
  getReadiness: vi.fn(),
  getContacts: vi.fn(),
  getTraining: vi.fn(),
  startOnboarding: vi.fn(),
  pauseOnboarding: vi.fn(),
  submitOnboarding: vi.fn(),
  completeOnboarding: vi.fn(),
  updateChecklist: vi.fn(),
  addContact: vi.fn(),
  assignTraining: vi.fn(),
  finishTraining: vi.fn(),
}))
const schoolId = '123e4567-e89b-42d3-a456-426614174001'
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getOnboarding).mockResolvedValue(null)
  vi.mocked(getChecklist).mockResolvedValue([
    { key: 'academicYear', source: 'system', status: 'pending' },
    { key: 'backupContactConfirmed', source: 'manual', status: 'pending' },
  ])
  vi.mocked(getReadiness).mockResolvedValue({
    status: 'blocked',
    checks: [
      {
        key: 'academicYear',
        status: 'blocked',
        reason: 'No academic year is configured',
      },
    ],
  })
  vi.mocked(getContacts).mockResolvedValue([])
  vi.mocked(getTraining).mockResolvedValue([])
  vi.mocked(startOnboarding).mockResolvedValue()
  vi.mocked(updateChecklist).mockResolvedValue()
})
afterEach(cleanup)

describe('school onboarding workspace', () => {
  it('shows evidence-based blockers and prevents submitting them as complete', async () => {
    render(<SchoolOnboardingWorkspace baseUrl="/api" schoolId={schoolId} />)
    fireEvent.click(screen.getByRole('button', { name: 'School onboarding' }))
    expect(
      await screen.findByText(/No academic year is configured/),
    ).toBeTruthy()
    expect(
      screen.getByText(
        /academicYear: pending \(Verified from Warka configuration\)/,
      ),
    ).toBeTruthy()
    expect(screen.queryByLabelText('Set academicYear')).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Submit onboarding for review' }),
    ).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Start onboarding' }))
    await waitFor(() =>
      expect(startOnboarding).toHaveBeenCalledWith('/api', schoolId),
    )
  })
})
