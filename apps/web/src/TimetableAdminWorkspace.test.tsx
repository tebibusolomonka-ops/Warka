import { afterEach, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { TimetableAdminWorkspace } from './TimetableAdminWorkspace'
import { getAcademicStructure, getTeachingAssignments } from './academicApi'
import {
  getClassTimetable,
  getClassTimetables,
  getSchoolCalendarDays,
  getTimetablePeriods,
  transitionClassTimetable,
  validateClassTimetable,
} from './timetableApi'

vi.mock('./academicApi', () => ({
  getAcademicStructure: vi.fn(),
  getTeachingAssignments: vi.fn(),
}))
vi.mock('./timetableApi', () => ({
  addClassTimetableEntry: vi.fn(),
  addSchoolCalendarDay: vi.fn(),
  addTimetablePeriod: vi.fn(),
  createTimetableDraft: vi.fn(),
  getClassTimetable: vi.fn(),
  getClassTimetables: vi.fn(),
  getSchoolCalendarDays: vi.fn(),
  getTimetablePeriods: vi.fn(),
  removeClassTimetableEntry: vi.fn(),
  transitionClassTimetable: vi.fn(),
  validateClassTimetable: vi.fn(),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

it('shows an accessible weekly grid and blocks publication until validation succeeds', async () => {
  const yearId = '123e4567-e89b-42d3-a456-426614174001'
  const classId = '123e4567-e89b-42d3-a456-426614174002'
  const planId = '123e4567-e89b-42d3-a456-426614174003'
  vi.mocked(getAcademicStructure).mockResolvedValue({
    role: 'administrator',
    academicYears: [{ id: yearId, name: 'Year', startsOn: '', endsOn: '' }],
    classes: [
      {
        id: classId,
        academicYearId: yearId,
        name: 'A',
        gradeLevelName: 'Grade 1',
      },
    ],
    subjects: [{ id: 'subject', name: 'Mathematics', code: null }],
    teachers: [{ id: 'teacher', displayName: 'Teacher' }],
    gradingPeriods: [],
  })
  vi.mocked(getTeachingAssignments).mockResolvedValue([])
  vi.mocked(getTimetablePeriods).mockResolvedValue([
    {
      id: 'period',
      name: 'First',
      startTime: '08:00',
      endTime: '08:45',
      sortOrder: 1,
      instructional: true,
    },
  ])
  vi.mocked(getSchoolCalendarDays).mockResolvedValue([])
  vi.mocked(getClassTimetables).mockResolvedValue([
    {
      id: planId,
      status: 'draft',
      academicYearId: yearId,
      schoolClassId: classId,
      publishedAt: null,
    },
  ])
  vi.mocked(getClassTimetable).mockResolvedValue({
    plan: {
      id: planId,
      status: 'draft',
      academicYearId: yearId,
      schoolClassId: classId,
      publishedAt: null,
    },
    entries: [
      {
        id: 'entry',
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
        teachingAssignment: { userId: 'teacher' },
      },
    ],
  })
  vi.mocked(validateClassTimetable)
    .mockResolvedValueOnce([{ code: 'TEACHER_COLLISION', entryId: 'entry' }])
    .mockResolvedValueOnce([])
  vi.mocked(transitionClassTimetable).mockResolvedValue({})
  render(<TimetableAdminWorkspace baseUrl="/api" schoolId="school" />)
  await screen.findByText('Mathematics')
  expect(
    screen.getByRole('table', { name: 'Weekly class timetable' }),
  ).toBeTruthy()
  const publish = screen.getByRole('button', {
    name: 'Publish timetable',
  }) as HTMLButtonElement
  expect(publish.disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Validate timetable' }))
  await screen.findByText('TEACHER_COLLISION')
  expect(publish.disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Validate timetable' }))
  await waitFor(() => expect(publish.disabled).toBe(false))
  fireEvent.click(publish)
  await waitFor(() =>
    expect(transitionClassTimetable).toHaveBeenCalledWith(
      '/api',
      'school',
      planId,
      'publish',
    ),
  )
})
