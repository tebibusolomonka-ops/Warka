import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { GradebookWorkspace } from './GradebookWorkspace'
import * as gradebook from './gradebookApi'

vi.mock('./gradebookApi', () => ({
  getCompleteness: vi.fn(),
  getWindow: vi.fn(),
  getModeration: vi.fn(),
  getLock: vi.fn(),
  getReadiness: vi.fn(),
}))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

it('distinguishes absent, pending make-up, missing mark and recorded zero', async () => {
  vi.mocked(gradebook.getCompleteness).mockResolvedValue({
    complete: false,
    counts: {
      eligible: 3,
      marksEntered: 1,
      marksMissing: 2,
      absent: 1,
      pendingMakeUp: 1,
      invalidMarks: 0,
    },
    rows: [
      {
        enrollmentId: 'one',
        studentReference: 'S1',
        studentName: 'One',
        participation: 'absent',
        makeUpStatus: 'requested',
        mark: null,
        issues: ['MISSING_MARK', 'ABSENT', 'PENDING_MAKE_UP'],
        blockingIssues: ['MISSING_MARK', 'PENDING_MAKE_UP'],
      },
      {
        enrollmentId: 'two',
        studentReference: 'S2',
        studentName: 'Two',
        participation: null,
        makeUpStatus: null,
        mark: null,
        issues: ['MISSING_MARK'],
        blockingIssues: ['MISSING_MARK'],
      },
      {
        enrollmentId: 'three',
        studentReference: 'S3',
        studentName: 'Three',
        participation: 'present',
        makeUpStatus: null,
        mark: { id: 'mark', score: '0.00' },
        issues: [],
        blockingIssues: [],
      },
    ],
  })
  vi.mocked(gradebook.getWindow).mockResolvedValue({
    window: { status: 'open', opensAt: '', closesAt: '' },
  })
  vi.mocked(gradebook.getModeration).mockResolvedValue({ requests: [] })
  vi.mocked(gradebook.getLock).mockResolvedValue({ lock: null })
  vi.mocked(gradebook.getReadiness).mockResolvedValue({
    ready: false,
    warnings: [],
    blockingIssues: [{ code: 'INCOMPLETE_GRADEBOOK' }],
    resultStatus: 'draft',
  })
  render(
    <GradebookWorkspace
      baseUrl="/api"
      schoolId="school"
      role="teacher"
      context={{
        academicYearId: 'year',
        gradingPeriodId: 'period',
        schoolClassId: 'class',
        subjectId: 'subject',
      }}
      assessments={[
        {
          id: 'assessment',
          name: 'Exam',
          maximumScore: '10',
          weight: '1',
          position: 1,
        },
      ]}
    />,
  )
  expect(await screen.findByText(/Make-up requested/)).toBeTruthy()
  expect(screen.getAllByText('Missing mark').length).toBe(2)
  expect(screen.getByText(/Recorded zero: 0.00/)).toBeTruthy()
  expect(screen.getByText('Not recorded')).toBeTruthy()
  expect(screen.getByText(/Not ready for publication/)).toBeTruthy()
})
