import { afterEach, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { AssessmentCalendarWorkspace } from './AssessmentCalendarWorkspace'
import { getAcademicStructure } from './academicApi'
import { requestJson } from './api'
import {
  getAssessmentRooms,
  getAssessmentSchedules,
  getAssessmentRoster,
  getMakeUps,
  validateSchedule,
  transitionSchedule,
} from './assessmentScheduleApi'

vi.mock('./academicApi', () => ({ getAcademicStructure: vi.fn() }))
vi.mock('./api', () => ({ requestJson: vi.fn() }))
vi.mock('./assessmentScheduleApi', () => ({
  getAssessmentRooms: vi.fn(),
  getAssessmentSchedules: vi.fn(),
  getAssessmentRoster: vi.fn(),
  getMakeUps: vi.fn(),
  validateSchedule: vi.fn(),
  transitionSchedule: vi.fn(),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function fixture() {
  vi.mocked(getAcademicStructure).mockResolvedValue({
    role: 'administrator',
    academicYears: [{ id: 'year', name: 'Year', startsOn: '', endsOn: '' }],
    gradingPeriods: [
      {
        id: 'period',
        academicYearId: 'year',
        name: 'Term',
        startsOn: '',
        endsOn: '',
      },
    ],
    classes: [
      {
        id: 'class',
        academicYearId: 'year',
        name: 'A',
        gradeLevelName: 'Grade 1',
      },
    ],
    subjects: [{ id: 'subject', name: 'Math', code: null }],
    teachers: [{ id: 'teacher', displayName: 'Teacher' }],
  })
  vi.mocked(requestJson).mockResolvedValue([
    {
      id: 'assessment',
      name: 'Quiz',
      maximumScore: '20',
      weight: '100',
      position: 0,
    },
  ])
  vi.mocked(getAssessmentRooms).mockResolvedValue([])
  vi.mocked(getMakeUps).mockResolvedValue([])
  vi.mocked(getAssessmentRoster).mockResolvedValue([
    {
      studentId: 'student-1',
      reference: 'S1',
      name: 'One',
      participation: { id: 'participation', status: 'absent' },
    },
    {
      studentId: 'student-2',
      reference: 'S2',
      name: 'Two',
      participation: null,
    },
  ])
  vi.mocked(getAssessmentSchedules).mockResolvedValue([
    {
      id: 'schedule',
      academicYearId: 'year',
      gradingPeriodId: 'period',
      schoolClassId: 'class',
      subjectId: 'subject',
      assessmentId: 'assessment',
      roomId: null,
      scheduledDate: '2026-10-10',
      startTime: '09:00',
      endTime: '10:00',
      status: 'draft',
      assessment: { name: 'Quiz' },
      room: null,
      sessions: [],
    },
    {
      id: 'scheduled-assessment',
      academicYearId: 'year',
      gradingPeriodId: 'period',
      schoolClassId: 'class',
      subjectId: 'subject',
      assessmentId: 'assessment',
      roomId: null,
      scheduledDate: '2026-10-11',
      startTime: '09:00',
      endTime: '10:00',
      status: 'scheduled',
      assessment: { name: 'Final' },
      room: null,
      sessions: [{ id: 'session', status: 'open' }],
    },
  ])
}

it('shows blocking conflicts and keeps missing participation separate from absence', async () => {
  fixture()
  vi.mocked(validateSchedule).mockResolvedValue({
    valid: false,
    issues: [{ code: 'ROOM_COLLISION' }],
  })
  render(<AssessmentCalendarWorkspace baseUrl="/api" schoolId="school" />)
  await screen.findByText('Quiz')
  fireEvent.click(screen.getAllByRole('button', { name: 'Validate' })[0]!)
  expect(await screen.findByText('ROOM_COLLISION')).toBeTruthy()
  expect(
    screen.getByRole('button', { name: 'Schedule' }).hasAttribute('disabled'),
  ).toBe(true)
  expect(transitionSchedule).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Participation' }))
  const panel = await screen.findByRole('region', {
    name: 'Assessment participation',
  })
  await waitFor(() =>
    expect(within(panel).getByText('Missing participation')).toBeTruthy(),
  )
  expect(within(panel).getAllByText('absent').length).toBeGreaterThan(0)
  expect(within(panel).queryByText('0')).toBeNull()
})
