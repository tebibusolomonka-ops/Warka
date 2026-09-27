import { afterEach, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { DataGovernanceWorkspace } from './DataGovernanceWorkspace'
import {
  createRetentionHold,
  getDataGovernanceSummary,
  getRetentionHolds,
} from './dataGovernanceApi'

vi.mock('./dataGovernanceApi', () => ({
  createRetentionHold: vi.fn(),
  getDataGovernanceSummary: vi.fn(),
  getRetentionHolds: vi.fn(),
  releaseRetentionHold: vi.fn(),
}))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
const id = '123e4567-e89b-42d3-a456-426614174001'
it('summarizes records without rankings and creates a scoped hold', async () => {
  vi.mocked(getDataGovernanceSummary).mockResolvedValue({
    organizationId: id,
    schoolId: id,
    openRequests: 2,
    statuses: [{ status: 'submitted', count: 2 }],
    activeRestrictions: 1,
    recentCorrections: [],
    recentStaffChanges: [],
  })
  vi.mocked(getRetentionHolds).mockResolvedValue({ total: 0, items: [] })
  vi.mocked(createRetentionHold).mockResolvedValue(undefined)
  render(
    <DataGovernanceWorkspace
      baseUrl="http://localhost:3000/api"
      organizationId={id}
      schoolId={id}
    />,
  )
  await screen.findByText(/Open privacy requests: 2/)
  expect(screen.queryByText(/risk score|rank/i)).toBeNull()
  fireEvent.change(screen.getByLabelText('Record ID'), {
    target: { value: id },
  })
  fireEvent.change(screen.getByLabelText('Reason'), {
    target: { value: 'Pending records review' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Create hold' }))
  await waitFor(() =>
    expect(createRetentionHold).toHaveBeenCalledWith(
      'http://localhost:3000/api',
      id,
      { scope: 'student', recordId: id, reason: 'Pending records review' },
    ),
  )
})
