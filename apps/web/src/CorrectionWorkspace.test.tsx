import { afterEach, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import type { StudentDetailResponse } from '@warka/shared'
import { CorrectionWorkspace } from './CorrectionWorkspace'
import type { StudentCorrection } from './correctionApi'
import {
  getCorrections,
  requestStudentCorrection,
  decideCorrection,
} from './correctionApi'
import { getStudentOptions } from './api'

vi.mock('./correctionApi', () => ({
  getCorrections: vi.fn(),
  requestStudentCorrection: vi.fn(),
  requestEnrollmentCorrection: vi.fn(),
  decideCorrection: vi.fn(),
}))
vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api')>()),
  getStudentOptions: vi.fn(),
}))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const schoolId = '123e4567-e89b-42d3-a456-426614174001'
const studentId = '123e4567-e89b-42d3-a456-426614174002'
const requestId = '123e4567-e89b-42d3-a456-426614174003'
const baseUrl = 'http://localhost:3000/api'
const detail = {
  student: {
    id: studentId,
    studentReference: 'WKA-1',
    givenName: 'Hana',
    familyName: 'Bekele',
    dateOfBirth: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  enrollments: [],
  guardians: [],
} as StudentDetailResponse
const request: StudentCorrection = {
  id: requestId,
  studentId,
  field: 'givenName',
  previousValue: 'Hana',
  proposedValue: 'Hanna',
  reason: 'Name recorded incorrectly',
  status: 'pending',
  requestedAt: '2026-01-01T00:00:00.000Z',
  requestedBy: { id: requestId, displayName: 'Registrar' },
  reviewReason: null,
  effectiveAt: null,
  student: {
    id: studentId,
    givenName: 'Hana',
    familyName: 'Bekele',
    studentReference: 'WKA-1',
  },
}

it('keeps proposed identity distinct from official identity and refreshes after approval', async () => {
  vi.mocked(getCorrections).mockImplementation(
    async (_base, _school, kind) => ({
      total: kind === 'student' ? 1 : 0,
      items: kind === 'student' ? [request] : [],
      take: 50,
      skip: 0,
    }),
  )
  vi.mocked(getStudentOptions).mockResolvedValue({
    academicYears: [],
    gradeLevels: [],
    classes: [],
  })
  vi.mocked(decideCorrection).mockResolvedValue(undefined)
  const onApplied = vi.fn()
  render(
    <CorrectionWorkspace
      baseUrl={baseUrl}
      schoolId={schoolId}
      detail={detail}
      canRequest
      canApprove
      canApproveIdentity
      onSessionExpired={vi.fn()}
      onApplied={onApplied}
    />,
  )
  expect(screen.getByText(/Official values are shown/)).toBeTruthy()
  await screen.findByText(/Previous official: Hana/)
  fireEvent.click(screen.getByRole('button', { name: 'Approve' }))
  await waitFor(() =>
    expect(decideCorrection).toHaveBeenCalledWith(
      baseUrl,
      schoolId,
      'student',
      requestId,
      'approve',
      undefined,
    ),
  )
  expect(onApplied).toHaveBeenCalledWith(studentId)
})

it('allows a registrar to request without displaying approval controls', async () => {
  vi.mocked(getCorrections).mockResolvedValue({
    total: 0,
    items: [],
    take: 50,
    skip: 0,
  })
  vi.mocked(getStudentOptions).mockResolvedValue({
    academicYears: [],
    gradeLevels: [],
    classes: [],
  })
  vi.mocked(requestStudentCorrection).mockResolvedValue(undefined)
  render(
    <CorrectionWorkspace
      baseUrl={baseUrl}
      schoolId={schoolId}
      detail={detail}
      canRequest
      canApprove={false}
      canApproveIdentity={false}
      onSessionExpired={vi.fn()}
      onApplied={vi.fn()}
    />,
  )
  fireEvent.change(screen.getByLabelText('Proposed value'), {
    target: { value: 'Hanna' },
  })
  fireEvent.change(screen.getAllByLabelText('Reason')[0]!, {
    target: { value: 'Name recorded incorrectly' },
  })
  fireEvent.click(
    screen.getByRole('button', { name: 'Request identity correction' }),
  )
  await waitFor(() =>
    expect(requestStudentCorrection).toHaveBeenCalledWith(
      baseUrl,
      schoolId,
      studentId,
      {
        field: 'givenName',
        proposedValue: 'Hanna',
        reason: 'Name recorded incorrectly',
      },
    ),
  )
  expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull()
})
