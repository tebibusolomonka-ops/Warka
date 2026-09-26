import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { YearRolloverWorkspace } from './YearRolloverWorkspace'
import { getStudentOptions } from './api'
import {
  applyRollover,
  bulkPromoteRollover,
  createRolloverPlan,
  getRolloverPlan,
  getYearReadiness,
  previewRollover,
  refreshRolloverExceptions,
  reviewRollover,
} from './rolloverApi'

vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api')>()),
  getStudentOptions: vi.fn(),
}))
vi.mock('./rolloverApi', () => ({
  applyRollover: vi.fn(),
  bulkDecideRollover: vi.fn(),
  bulkPromoteRollover: vi.fn(),
  completeYearClosing: vi.fn(),
  createRolloverPlan: vi.fn(),
  getRolloverPlan: vi.fn(),
  getYearReadiness: vi.fn(),
  previewRollover: vi.fn(),
  refreshRolloverExceptions: vi.fn(),
  resolveRolloverException: vi.fn(),
  reviewRollover: vi.fn(),
  startYearClosing: vi.fn(),
}))
const schoolId = '123e4567-e89b-42d3-a456-426614174001',
  sourceYearId = '123e4567-e89b-42d3-a456-426614174002',
  targetYearId = '123e4567-e89b-42d3-a456-426614174003',
  sourceGradeId = '123e4567-e89b-42d3-a456-426614174004',
  targetGradeId = '123e4567-e89b-42d3-a456-426614174005',
  classId = '123e4567-e89b-42d3-a456-426614174006',
  planId = '123e4567-e89b-42d3-a456-426614174007',
  entryId = '123e4567-e89b-42d3-a456-426614174008',
  studentId = '123e4567-e89b-42d3-a456-426614174009',
  enrollmentId = '123e4567-e89b-42d3-a456-426614174010'
const options = {
  academicYears: [
    { id: sourceYearId, name: 'Source' },
    { id: targetYearId, name: 'Target' },
  ],
  gradeLevels: [
    { id: sourceGradeId, name: 'Grade 1' },
    { id: targetGradeId, name: 'Grade 2' },
  ],
  classes: [
    {
      id: classId,
      academicYearId: targetYearId,
      gradeLevelId: targetGradeId,
      name: 'Class A',
    },
  ],
}
const entry = {
  id: entryId,
  studentId,
  sourceEnrollmentId: enrollmentId,
  action: 'manualReview' as const,
  targetGradeLevelId: null,
  targetSchoolClassId: null,
  student: {
    studentReference: 'SYN-1',
    givenName: 'Synthetic',
    familyName: 'Student',
  },
  sourceEnrollment: { gradeLevelId: sourceGradeId, schoolClassId: null },
}
const plan = {
  id: planId,
  schoolId,
  sourceAcademicYearId: sourceYearId,
  targetAcademicYearId: targetYearId,
  status: 'draft' as const,
  entries: [entry],
}
const promoted = {
  ...plan,
  entries: [
    {
      ...entry,
      action: 'promote' as const,
      targetGradeLevelId: targetGradeId,
      targetSchoolClassId: classId,
    },
  ],
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getStudentOptions).mockResolvedValue(options)
  vi.mocked(getYearReadiness).mockResolvedValue({
    yearId: sourceYearId,
    status: 'active',
    blockers: [{ kind: 'pendingEnrollments', count: 1 }],
    canClose: false,
  })
  vi.mocked(createRolloverPlan).mockResolvedValue(plan)
  vi.mocked(getRolloverPlan).mockResolvedValue(promoted)
  vi.mocked(bulkPromoteRollover).mockResolvedValue(undefined)
  vi.mocked(previewRollover).mockResolvedValue({
    planId,
    status: 'draft',
    counts: { promote: 1, repeat: 0, withdraw: 0, manualReview: 0 },
    problems: [],
    blockingErrors: 0,
  })
  vi.mocked(refreshRolloverExceptions).mockResolvedValue([])
  vi.mocked(reviewRollover).mockResolvedValue(undefined)
  vi.mocked(applyRollover).mockResolvedValue({
    planId,
    newEnrollments: 1,
    promotions: 1,
    repeats: 0,
    withdrawalDecisions: 0,
    sourceEnrollmentsPreserved: 1,
  })
})
afterEach(cleanup)

async function open() {
  render(
    <YearRolloverWorkspace
      baseUrl="/api"
      schoolId={schoolId}
      onSessionExpired={vi.fn()}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Year rollover' }))
  await screen.findByLabelText('Source academic year')
}

describe('year rollover workspace', () => {
  it('shows closing blockers and creates a plan for selected years', async () => {
    await open()
    expect(await screen.findByText('pendingEnrollments: 1')).toBeTruthy()
    fireEvent.click(
      screen.getByRole('button', { name: 'Create progression plan' }),
    )
    await waitFor(() =>
      expect(createRolloverPlan).toHaveBeenCalledWith(
        '/api',
        schoolId,
        sourceYearId,
        targetYearId,
      ),
    )
    expect(await screen.findByLabelText('Select SYN-1')).toBeTruthy()
  })
  it('keeps manual review visible and blocks final apply', async () => {
    await open()
    fireEvent.click(
      screen.getByRole('button', { name: 'Create progression plan' }),
    )
    await screen.findByLabelText('Select SYN-1')
    vi.mocked(previewRollover).mockResolvedValue({
      planId,
      status: 'draft',
      counts: { promote: 0, repeat: 0, withdraw: 0, manualReview: 1 },
      problems: [{ code: 'manualReview', entryId }],
      blockingErrors: 1,
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Validate and preview' }),
    )
    expect(
      await screen.findByText(/Manual review: 1; Blocking errors: 1/),
    ).toBeTruthy()
    expect(
      screen
        .getByRole('button', { name: 'Confirm review' })
        .hasAttribute('disabled'),
    ).toBe(true)
    expect(screen.queryByRole('button', { name: 'Apply rollover' })).toBeNull()
  })
  it('prepares promotions, reviews and applies with a source-history summary', async () => {
    await open()
    fireEvent.click(
      screen.getByRole('button', { name: 'Create progression plan' }),
    )
    await screen.findByLabelText('Select SYN-1')
    fireEvent.change(screen.getByLabelText('Source grade'), {
      target: { value: sourceGradeId },
    })
    fireEvent.change(screen.getByLabelText('Target grade'), {
      target: { value: targetGradeId },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Prepare promotions' }))
    await waitFor(() => expect(bulkPromoteRollover).toHaveBeenCalled())
    fireEvent.click(
      screen.getByRole('button', { name: 'Validate and preview' }),
    )
    await screen.findByText(/Promote: 1; Repeat: 0/)
    fireEvent.click(
      screen.getByLabelText('I reviewed every progression decision'),
    )
    vi.mocked(getRolloverPlan)
      .mockResolvedValueOnce({ ...promoted, status: 'reviewed' })
      .mockResolvedValueOnce({ ...promoted, status: 'applied' })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm review' }))
    await screen.findByRole('button', { name: 'Apply rollover' })
    fireEvent.click(screen.getByRole('button', { name: 'Apply rollover' }))
    expect(
      await screen.findByText(/1 source-year enrollment records preserved/),
    ).toBeTruthy()
  })
})
