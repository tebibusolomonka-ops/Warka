import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { DataQualityWorkspace } from './DataQualityWorkspace'
import {
  dismissQualityIssue,
  getLatestQualityRun,
  listQualityIssues,
  runQualityChecks,
} from './dataQualityApi'

vi.mock('./dataQualityApi', () => ({
  dismissQualityIssue: vi.fn(),
  getLatestQualityRun: vi.fn(),
  listQualityIssues: vi.fn(),
  runQualityChecks: vi.fn(),
}))
const schoolId = '11111111-1111-4111-8111-111111111111'
const issue = {
  id: 'issue',
  category: 'student',
  severity: 'warning',
  code: 'STUDENT_REFERENCE_MISSING',
  status: 'open',
  summary: 'Reference missing',
  entityType: 'student',
  entityId: 'student',
  detectedAt: '2026-01-01T00:00:00Z',
  resolvedAt: null,
  dismissalReason: null,
} as const
beforeEach(() => {
  vi.mocked(getLatestQualityRun)
    .mockReset()
    .mockResolvedValue({
      run: {
        id: 'run',
        status: 'completed',
        trigger: 'manual',
        startedAt: '2026-01-01T00:00:00Z',
        completedAt: '2026-01-01T00:01:00Z',
        infoCount: 0,
        warningCount: 1,
        blockingCount: 0,
      },
    })
  vi.mocked(listQualityIssues)
    .mockReset()
    .mockResolvedValue({ issues: [issue], nextCursor: null })
  vi.mocked(runQualityChecks).mockReset().mockResolvedValue({})
  vi.mocked(dismissQualityIssue).mockReset().mockResolvedValue({})
})
afterEach(cleanup)
describe('data quality workspace', () => {
  it('shows factual counts, links correction workflow and runs evaluation explicitly', async () => {
    render(<DataQualityWorkspace baseUrl="" schoolId={schoolId} />)
    expect(await screen.findByText(/0 blocking, 1 warnings/)).toBeTruthy()
    expect(
      screen
        .getByRole('link', { name: 'Open related workflow' })
        .getAttribute('href'),
    ).toBe('#students-heading')
    expect(screen.queryByText(/quality score|school ranking/i)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Run evaluation' }))
    await waitFor(() =>
      expect(runQualityChecks).toHaveBeenCalledWith('', schoolId),
    )
  })
  it('requires a dismissal reason and never offers automatic record changes', async () => {
    render(<DataQualityWorkspace baseUrl="" schoolId={schoolId} />)
    await screen.findByText('STUDENT_REFERENCE_MISSING')
    const button = screen.getByRole('button', {
      name: 'Dismiss',
    }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Dismissal reason'), {
      target: { value: 'Reviewed' },
    })
    fireEvent.click(button)
    await waitFor(() =>
      expect(dismissQualityIssue).toHaveBeenCalledWith(
        '',
        schoolId,
        'issue',
        'Reviewed',
      ),
    )
  })
})
