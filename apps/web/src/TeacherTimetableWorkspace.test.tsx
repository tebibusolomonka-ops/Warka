import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { TeacherTimetableWorkspace } from './TeacherTimetableWorkspace'
import { getAcademicStructure } from './academicApi'
import {
  getOwnTeacherCalendarDays,
  getOwnTeacherTimetable,
} from './timetableApi'

vi.mock('./academicApi', () => ({ getAcademicStructure: vi.fn() }))
vi.mock('./timetableApi', () => ({
  getOwnTeacherTimetable: vi.fn(),
  getOwnTeacherCalendarDays: vi.fn(),
}))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

it('shows only API-scoped assigned lessons with today and week views', async () => {
  vi.mocked(getAcademicStructure).mockResolvedValue({
    role: 'teacher',
    academicYears: [
      { id: 'year', name: 'School year', startsOn: '', endsOn: '' },
    ],
    classes: [],
    subjects: [],
    gradingPeriods: [],
    teachers: [],
  })
  vi.mocked(getOwnTeacherTimetable).mockResolvedValue([
    {
      id: 'lesson',
      weekday: 1,
      subject: { id: 'subject', name: 'Mathematics' },
      timetablePeriod: {
        id: 'period',
        name: 'First',
        startTime: '08:00',
        endTime: '08:45',
        sortOrder: 1,
        instructional: true,
      },
      schoolClass: { id: 'class', name: 'A' },
      teachingAssignment: { userId: 'teacher' },
    },
  ])
  vi.mocked(getOwnTeacherCalendarDays).mockResolvedValue([])
  render(<TeacherTimetableWorkspace baseUrl="/api" schoolId="school" />)
  await screen.findByRole('heading', { name: 'My timetable' })
  fireEvent.click(screen.getByRole('button', { name: 'Week' }))
  await screen.findByText('Mathematics')
  expect(
    screen.getByRole('table', { name: 'Weekly assigned lessons' }),
  ).toBeTruthy()
  expect(getOwnTeacherTimetable).toHaveBeenCalledWith('/api', 'school', 'year')
  expect(screen.queryByText('Another teacher')).toBeNull()
})
