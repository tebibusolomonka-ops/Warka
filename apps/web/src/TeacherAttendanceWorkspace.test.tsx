import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TeacherAttendanceWorkspace } from './TeacherAttendanceWorkspace'
import { getAcademicStructure } from './academicApi'
import {
  getOwnTeacherCalendarDays,
  getOwnTeacherTimetable,
} from './timetableApi'
import {
  getAttendanceSessions,
  openAttendanceSession,
  getAttendanceRoster,
  saveAttendance,
  submitAttendance,
} from './attendanceApi'

vi.mock('./academicApi', () => ({ getAcademicStructure: vi.fn() }))
vi.mock('./timetableApi', () => ({
  getOwnTeacherCalendarDays: vi.fn(),
  getOwnTeacherTimetable: vi.fn(),
}))
vi.mock('./attendanceApi', () => ({
  getAttendanceSessions: vi.fn(),
  openAttendanceSession: vi.fn(),
  getAttendanceRoster: vi.fn(),
  saveAttendance: vi.fn(),
  submitAttendance: vi.fn(),
  correctAttendance: vi.fn(),
}))

const weekday = ((new Date().getDay() + 6) % 7) + 1
const entry = {
  id: 'entry',
  weekday,
  schoolClassId: 'class',
  subjectId: 'subject',
  teachingAssignmentId: 'assignment',
  timetablePeriodId: 'period',
  schoolClass: { id: 'class', name: 'A' },
  subject: { id: 'subject', name: 'Math' },
  timetablePeriod: { id: 'period', name: 'Period 1', instructional: true },
}

beforeEach(() => {
  vi.mocked(getAcademicStructure).mockResolvedValue({
    academicYears: [{ id: 'year', name: 'Year' }],
  } as never)
  vi.mocked(getOwnTeacherTimetable).mockResolvedValue([entry] as never)
  vi.mocked(getOwnTeacherCalendarDays).mockResolvedValue([])
  vi.mocked(getAttendanceSessions).mockResolvedValue({ sessions: [] })
  vi.mocked(openAttendanceSession).mockResolvedValue({
    id: 'session',
    status: 'open',
  } as never)
  vi.mocked(getAttendanceRoster).mockResolvedValue({
    session: {
      id: 'session',
      status: 'open',
      date: '2026-09-28',
      schoolClassId: 'class',
      subjectId: 'subject',
      timetablePeriodId: 'period',
    },
    enrollments: [
      {
        id: 'enrollment',
        studentId: 'student',
        student: { givenName: 'Ada', familyName: 'Test' },
      },
    ],
    records: [],
    unrecordedCount: 1,
  })
  vi.mocked(saveAttendance).mockResolvedValue({})
  vi.mocked(submitAttendance).mockResolvedValue({})
})

describe('teacher attendance workspace', () => {
  it('keeps students unrecorded until explicitly marked', async () => {
    render(<TeacherAttendanceWorkspace baseUrl="/api" schoolId="school" />)
    await screen.findByRole('option', { name: /Math/ })
    fireEvent.change(await screen.findByLabelText('Assigned class'), {
      target: { value: 'entry' },
    })
    fireEvent.click(await screen.findByText('Open attendance session'))
    expect(await screen.findByText('Unrecorded: 1')).toBeTruthy()
    fireEvent.click(screen.getByText('Submit attendance'))
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      '1 students are unrecorded. Record each student before submission.',
    )
    expect(submitAttendance).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Status for Ada'), {
      target: { value: 'present' },
    })
    await waitFor(() => expect(screen.getByText('Unrecorded: 0')).toBeTruthy())
  })
})
