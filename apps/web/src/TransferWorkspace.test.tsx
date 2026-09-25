import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { TransferWorkspace } from './TransferWorkspace'
import {
  actOnTransfer,
  createTransferRequest,
  getSchoolTransfers,
  getTransferDetail,
  getTransferOptions,
} from './transferApi'

vi.mock('./transferApi', () => ({
  actOnTransfer: vi.fn(),
  createTransferRequest: vi.fn(),
  getSchoolTransfers: vi.fn(),
  getTransferDetail: vi.fn(),
  getTransferOptions: vi.fn(),
}))

const schoolId = '123e4567-e89b-42d3-a456-426614174001'
const studentId = '123e4567-e89b-42d3-a456-426614174002'
const sourceEnrollmentId = '123e4567-e89b-42d3-a456-426614174003'
const receivingSchoolId = '123e4567-e89b-42d3-a456-426614174004'
const transferId = '123e4567-e89b-42d3-a456-426614174005'
const academicYearId = '123e4567-e89b-42d3-a456-426614174006'
const gradeLevelId = '123e4567-e89b-42d3-a456-426614174007'
const now = '2026-09-25T08:00:00.000Z'
const requested = {
  id: transferId,
  status: 'requested' as const,
  student: { displayName: 'Mina Learner', studentReference: 'WKA-1' },
  sendingSchool: 'Sending School',
  receivingSchool: 'Receiving School',
  sourceEnrollment: {
    status: 'approved' as const,
    academicYear: '2026',
    gradeLevel: 'Grade 2',
    schoolClass: null,
  },
  receivingEnrollment: null,
  requestedAt: now,
  sendingApprovedAt: null,
  completedAt: null,
  rejectionReason: null,
  cancellationReason: null,
}
const approved = {
  ...requested,
  status: 'approvedBySendingSchool' as const,
  sendingApprovedAt: now,
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getTransferOptions).mockResolvedValue({
    eligibleStudents: [
      {
        studentId,
        studentReference: 'WKA-1',
        displayName: 'Mina Learner',
        sourceEnrollmentId,
        academicYear: '2026',
        gradeLevel: 'Grade 2',
      },
    ],
    receivingSchools: [{ id: receivingSchoolId, name: 'Receiving School' }],
    academicYears: [{ id: academicYearId, name: '2026' }],
    gradeLevels: [{ id: gradeLevelId, name: 'Grade 2' }],
    classes: [],
  })
  vi.mocked(getSchoolTransfers).mockImplementation(
    async (_base, _school, direction) =>
      direction === 'outgoing' ? [requested] : [approved],
  )
  vi.mocked(getTransferDetail).mockResolvedValue(requested)
  vi.mocked(createTransferRequest).mockResolvedValue(requested)
  vi.mocked(actOnTransfer).mockResolvedValue(approved)
})
afterEach(cleanup)

function show() {
  render(
    <TransferWorkspace
      baseUrl="/api"
      schoolId={schoolId}
      schoolName="Sending School"
      onSessionExpired={vi.fn()}
    />,
  )
}

describe('transfer workspace', () => {
  it('requests and approves an outgoing transfer with source context', async () => {
    show()
    expect(await screen.findByText(/Source: 2026/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Request transfer' }))
    await waitFor(() =>
      expect(createTransferRequest).toHaveBeenCalledWith(
        '/api',
        schoolId,
        studentId,
        sourceEnrollmentId,
        receivingSchoolId,
      ),
    )
    expect(
      await screen.findByRole('heading', { name: 'Transfer detail' }),
    ).toBeTruthy()
    fireEvent.click(
      screen.getByRole('button', { name: 'Approve sending transfer' }),
    )
    await waitFor(() =>
      expect(actOnTransfer).toHaveBeenCalledWith(
        '/api',
        schoolId,
        transferId,
        'approve',
        {},
      ),
    )
  })

  it('accepts an approved incoming transfer into a pending enrollment', async () => {
    vi.mocked(getTransferDetail).mockResolvedValue(approved)
    vi.mocked(actOnTransfer).mockResolvedValue({
      ...approved,
      status: 'acceptedByReceivingSchool',
      receivingEnrollment: {
        status: 'pending',
        academicYear: '2026',
        gradeLevel: 'Grade 2',
        schoolClass: null,
      },
      completedAt: now,
    })
    show()
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Review incoming transfer for Mina Learner',
      }),
    )
    expect(
      await screen.findByRole('button', { name: 'Accept transfer' }),
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Accept transfer' }))
    await waitFor(() =>
      expect(actOnTransfer).toHaveBeenCalledWith(
        '/api',
        schoolId,
        transferId,
        'accept',
        { academicYearId, gradeLevelId, schoolClassId: null },
      ),
    )
    expect(await screen.findByText(/2026 · Grade 2 · pending/)).toBeTruthy()
  })

  it('requires a reason for rejection and does not mark a request complete', async () => {
    vi.mocked(getTransferDetail).mockResolvedValue(approved)
    show()
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Review incoming transfer for Mina Learner',
      }),
    )
    fireEvent.click(
      await screen.findByRole('button', { name: 'Reject transfer' }),
    )
    expect(
      screen.getByText('Enter a reason of at least three characters.'),
    ).toBeTruthy()
    expect(actOnTransfer).not.toHaveBeenCalled()
    expect(screen.queryByText('New receiving enrollment')).toBeNull()
  })
})
