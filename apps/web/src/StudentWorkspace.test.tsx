import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import type {
  AccessibleSchool,
  RegistrationResponse,
  StudentDetailResponse,
} from '@warka/shared'
import { StudentWorkspace } from './StudentWorkspace'
import {
  actOnEnrollment,
  ApiError,
  getStudentAccountStatus,
  provisionStudentAccount,
  getStudentDetail,
  getStudentOptions,
  getStudents,
  registerStudent,
} from './api'

vi.mock('./api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api')>()
  return {
    ...actual,
    actOnEnrollment: vi.fn(),
    getStudentAccountStatus: vi.fn(),
    provisionStudentAccount: vi.fn(),
    getStudentDetail: vi.fn(),
    getStudentOptions: vi.fn(),
    getStudents: vi.fn(),
    registerStudent: vi.fn(),
  }
})

const schoolId = '123e4567-e89b-42d3-a456-426614174001'
const studentId = '123e4567-e89b-42d3-a456-426614174002'
const enrollmentId = '123e4567-e89b-42d3-a456-426614174003'
const yearId = '123e4567-e89b-42d3-a456-426614174004'
const gradeId = '123e4567-e89b-42d3-a456-426614174005'
const baseUrl = 'http://localhost:3000/api'
const now = '2026-09-24T00:00:00.000Z'
const student = {
  id: studentId,
  studentReference: 'WKA-123456789',
  givenName: 'Hana',
  familyName: 'Bekele',
  dateOfBirth: '2018-02-28',
  createdAt: now,
  updatedAt: now,
}
const enrollment = {
  id: enrollmentId,
  studentId,
  schoolId,
  academicYearId: yearId,
  gradeLevelId: gradeId,
  schoolClassId: null,
  status: 'draft' as const,
  approvedAt: null,
  approvedById: null,
  withdrawnAt: null,
  withdrawnById: null,
  createdAt: now,
  updatedAt: now,
}
const registration: RegistrationResponse = {
  student,
  enrollment,
  guardians: [],
  duplicateWarnings: {
    requiresHumanReview: true,
    candidates: [
      {
        id: '123e4567-e89b-42d3-a456-426614174006',
        studentReference: 'WKA-EXISTING',
        givenName: 'Hana',
        familyName: 'Bekele',
        dateOfBirth: '2018-02-28',
      },
    ],
  },
}
const school = {
  id: schoolId,
  organizationId: '123e4567-e89b-42d3-a456-426614174007',
  name: 'First school',
  createdAt: now,
  updatedAt: now,
}
const options = {
  academicYears: [{ id: yearId, name: '2026' }],
  gradeLevels: [{ id: gradeId, name: 'Grade 1' }],
  classes: [
    {
      id: '123e4567-e89b-42d3-a456-426614174008',
      name: 'A',
      academicYearId: yearId,
      gradeLevelId: gradeId,
    },
  ],
}

function access(
  capabilities: AccessibleSchool['capabilities'],
): AccessibleSchool {
  return { school, capabilities }
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getStudents).mockResolvedValue({ items: [], limit: 50, offset: 0 })
  vi.mocked(getStudentOptions).mockResolvedValue(options)
  vi.mocked(getStudentAccountStatus).mockResolvedValue({ status: 'none' })
  vi.mocked(provisionStudentAccount).mockResolvedValue(undefined)
})

afterEach(cleanup)

describe('student workspace', () => {
  it('shows portal status and provisions a student account without retaining the initial password', async () => {
    vi.mocked(getStudents).mockResolvedValue({
      items: [{ student, enrollment }],
      limit: 50,
      offset: 0,
    })
    vi.mocked(getStudentDetail).mockResolvedValue({
      student,
      enrollments: [enrollment],
      guardians: [],
    })
    vi.mocked(getStudentAccountStatus)
      .mockResolvedValueOnce({ status: 'none' })
      .mockResolvedValue({
        status: 'active',
        email: 'hana@example.test',
        displayName: 'Hana',
        mustChangePassword: true,
      })
    render(
      <StudentWorkspace
        baseUrl={baseUrl}
        access={access({
          canRegister: true,
          canSubmit: true,
          canApprove: false,
        })}
        onSessionExpired={vi.fn()}
      />,
    )
    fireEvent.click(await screen.findByRole('button', { name: /Hana Bekele/ }))
    await screen.findByText('No account')
    fireEvent.change(screen.getByLabelText('Account email'), {
      target: { value: 'hana@example.test' },
    })
    fireEvent.change(screen.getByLabelText('Display name'), {
      target: { value: 'Hana' },
    })
    fireEvent.change(screen.getByLabelText('Initial password'), {
      target: { value: 'initial password' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
    await waitFor(() =>
      expect(provisionStudentAccount).toHaveBeenCalledWith(
        baseUrl,
        schoolId,
        studentId,
        {
          email: 'hana@example.test',
          displayName: 'Hana',
          initialPassword: 'initial password',
        },
      ),
    )
    await screen.findByText('Password change required')
    expect(screen.queryByDisplayValue('initial password')).toBeNull()
    expect(screen.getByText('Student account created.')).toBeTruthy()
  })

  it('shows a duplicate account error and hides provisioning from approvers', async () => {
    vi.mocked(getStudents).mockResolvedValue({
      items: [{ student, enrollment }],
      limit: 50,
      offset: 0,
    })
    vi.mocked(getStudentDetail).mockResolvedValue({
      student,
      enrollments: [enrollment],
      guardians: [],
    })
    vi.mocked(provisionStudentAccount).mockRejectedValue(
      new ApiError(
        'Student already has an account',
        409,
        'STUDENT_ACCOUNT_CONFLICT',
      ),
    )
    const first = render(
      <StudentWorkspace
        baseUrl={baseUrl}
        access={access({
          canRegister: true,
          canSubmit: true,
          canApprove: false,
        })}
        onSessionExpired={vi.fn()}
      />,
    )
    fireEvent.click(await screen.findByRole('button', { name: /Hana Bekele/ }))
    await screen.findByText('No account')
    fireEvent.change(screen.getByLabelText('Account email'), {
      target: { value: 'hana@example.test' },
    })
    fireEvent.change(screen.getByLabelText('Display name'), {
      target: { value: 'Hana' },
    })
    fireEvent.change(screen.getByLabelText('Initial password'), {
      target: { value: 'initial password' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
    await screen.findByText('Student already has an account')
    first.unmount()
    vi.mocked(getStudentAccountStatus).mockClear()
    render(
      <StudentWorkspace
        baseUrl={baseUrl}
        access={access({
          canRegister: false,
          canSubmit: false,
          canApprove: true,
        })}
        onSessionExpired={vi.fn()}
      />,
    )
    fireEvent.click(await screen.findByRole('button', { name: /Hana Bekele/ }))
    await screen.findByText('Warka reference: WKA-123456789')
    expect(screen.queryByRole('heading', { name: 'Portal access' })).toBeNull()
    expect(getStudentAccountStatus).not.toHaveBeenCalled()
  })

  it('registers a student, shows the generated reference and possible duplicates, then submits the draft', async () => {
    vi.mocked(registerStudent).mockResolvedValue(registration)
    vi.mocked(actOnEnrollment).mockResolvedValue({
      ...enrollment,
      status: 'pending',
    })
    render(
      <StudentWorkspace
        baseUrl={baseUrl}
        access={access({
          canRegister: true,
          canSubmit: true,
          canApprove: false,
        })}
        onSessionExpired={vi.fn()}
      />,
    )
    await screen.findByText('No students registered yet.')
    fireEvent.click(screen.getByRole('button', { name: 'Register student' }))
    await screen.findByLabelText('Academic year')
    fireEvent.change(screen.getByLabelText('Given name'), {
      target: { value: 'Hana' },
    })
    fireEvent.change(screen.getByLabelText('Family name (optional)'), {
      target: { value: 'Bekele' },
    })
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Selam' },
    })
    fireEvent.change(screen.getByLabelText('Relationship'), {
      target: { value: 'Aunt' },
    })
    fireEvent.click(
      within(
        screen.getByRole('form', { name: 'Student registration' }),
      ).getByRole('button', {
        name: 'Register student',
      }),
    )
    await screen.findByText(/Registered Hana Bekele as/)
    expect(screen.getByText('WKA-123456789')).toBeTruthy()
    expect(
      screen.getByText(/Possible duplicate students require human review/),
    ).toBeTruthy()
    expect(registerStudent).toHaveBeenCalledWith(
      baseUrl,
      schoolId,
      expect.objectContaining({
        academicYearId: yearId,
        gradeLevelId: gradeId,
        guardians: [
          expect.objectContaining({ name: 'Selam', relationship: 'Aunt' }),
        ],
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Submit for review' }))
    await waitFor(() => expect(screen.getByText('pending')).toBeTruthy())
    expect(
      screen.queryByRole('button', { name: 'Approve enrollment' }),
    ).toBeNull()
  })

  it('shows pending approval to approvers without registration controls', async () => {
    vi.mocked(getStudents).mockResolvedValue({
      items: [{ student, enrollment: { ...enrollment, status: 'pending' } }],
      limit: 50,
      offset: 0,
    })
    const detail: StudentDetailResponse = {
      student,
      enrollments: [{ ...enrollment, status: 'pending' }],
      guardians: [],
    }
    vi.mocked(getStudentDetail).mockResolvedValue(detail)
    vi.mocked(actOnEnrollment).mockResolvedValue({
      ...enrollment,
      status: 'approved',
      approvedAt: now,
      approvedById: '123e4567-e89b-42d3-a456-426614174009',
    })
    render(
      <StudentWorkspace
        baseUrl={baseUrl}
        access={access({
          canRegister: false,
          canSubmit: false,
          canApprove: true,
        })}
        onSessionExpired={vi.fn()}
      />,
    )
    expect(
      screen.queryByRole('button', { name: 'Register student' }),
    ).toBeNull()
    fireEvent.click(await screen.findByRole('button', { name: /Hana Bekele/ }))
    expect(
      await screen.findByRole('button', { name: 'Approve enrollment' }),
    ).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: 'Submit for review' }),
    ).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Approve enrollment' }))
    await waitFor(() => expect(screen.getByText('approved')).toBeTruthy())
    expect(actOnEnrollment).toHaveBeenCalledWith(
      baseUrl,
      schoolId,
      enrollmentId,
      'approve',
    )
  })

  it('validates optional guardian details before sending registration', async () => {
    render(
      <StudentWorkspace
        baseUrl={baseUrl}
        access={access({
          canRegister: true,
          canSubmit: true,
          canApprove: false,
        })}
        onSessionExpired={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Register student' }))
    await screen.findByLabelText('Academic year')
    fireEvent.change(screen.getByLabelText('Given name'), {
      target: { value: 'Hana' },
    })
    fireEvent.change(screen.getByLabelText('Relationship'), {
      target: { value: 'Aunt' },
    })
    fireEvent.submit(screen.getByRole('form', { name: 'Student registration' }))
    await screen.findByText('Check the student, academic, and guardian fields.')
    expect(registerStudent).not.toHaveBeenCalled()
  })

  it('filters the loaded page by name or reference', async () => {
    vi.mocked(getStudents).mockResolvedValue({
      items: [{ student, enrollment }],
      limit: 50,
      offset: 0,
    })
    render(
      <StudentWorkspace
        baseUrl={baseUrl}
        access={access({
          canRegister: true,
          canSubmit: true,
          canApprove: false,
        })}
        onSessionExpired={vi.fn()}
      />,
    )
    await screen.findByRole('button', { name: /Hana Bekele/ })
    fireEvent.change(screen.getByLabelText('Search loaded students'), {
      target: { value: 'no match' },
    })
    expect(
      screen.getByText('No students match this search on the current page.'),
    ).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Search loaded students'), {
      target: { value: 'WKA-123456789' },
    })
    expect(screen.getByRole('button', { name: /Hana Bekele/ })).toBeTruthy()
  })
})
