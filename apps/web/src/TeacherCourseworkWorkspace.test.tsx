import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { TeacherCourseworkWorkspace } from './TeacherCourseworkWorkspace'
import {
  createTeacherCoursework,
  getTeacherCoursework,
  getTeacherCourseworkAudience,
  getTeacherCourseworkCounts,
  getTeacherSubmission,
  getTeacherRubric,
  listTeacherSubmissions,
  reviewTeacherRevision,
  saveTeacherRubric,
  scoreTeacherRevision,
  listTeacherCoursework,
  transitionTeacherCoursework,
} from './courseworkApi'
import type { AcademicStructure, TeachingAssignment } from './academicApi'

vi.mock('./courseworkApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./courseworkApi')>()),
  createTeacherCoursework: vi.fn(),
  getTeacherCoursework: vi.fn(),
  getTeacherCourseworkAudience: vi.fn(),
  getTeacherCourseworkCounts: vi.fn(),
  getTeacherSubmission: vi.fn(),
  getTeacherRubric: vi.fn(),
  listTeacherSubmissions: vi.fn(),
  reviewTeacherRevision: vi.fn(),
  saveTeacherRubric: vi.fn(),
  scoreTeacherRevision: vi.fn(),
  listTeacherCoursework: vi.fn(),
  transitionTeacherCoursework: vi.fn(),
}))
const schoolId = '00000000-0000-4000-8000-000000000001'
const assignmentId = '00000000-0000-4000-8000-000000000002'
const yearId = '00000000-0000-4000-8000-000000000003'
const classId = '00000000-0000-4000-8000-000000000004'
const subjectId = '00000000-0000-4000-8000-000000000005'
const row = {
  id: assignmentId,
  schoolId,
  academicYearId: yearId,
  schoolClassId: classId,
  subjectId,
  gradingPeriodId: null,
  title: 'Read chapter',
  instructions: 'Write a response',
  dueAt: '2026-11-01T12:00:00.000Z',
  status: 'draft' as const,
}
const structure: AcademicStructure = {
  role: 'teacher',
  academicYears: [
    { id: yearId, name: '2026', startsOn: '2026-01-01', endsOn: '2026-12-31' },
  ],
  classes: [
    {
      id: classId,
      academicYearId: yearId,
      name: 'A',
      gradeLevelName: 'Grade 1',
    },
  ],
  subjects: [{ id: subjectId, name: 'Science', code: null }],
  gradingPeriods: [],
  teachers: [],
}
const teachingAssignments: TeachingAssignment[] = [
  {
    id: assignmentId,
    userId: schoolId,
    academicYearId: yearId,
    schoolClassId: classId,
    subjectId,
  },
]
beforeEach(() => {
  vi.mocked(listTeacherCoursework)
    .mockReset()
    .mockResolvedValue({ assignments: [row] })
  vi.mocked(getTeacherCoursework)
    .mockReset()
    .mockResolvedValue({
      assignment: row,
      attachments: [
        { id: assignmentId, originalFileName: 'notes.pdf', status: 'pending' },
      ],
    })
  vi.mocked(getTeacherCourseworkCounts).mockReset().mockResolvedValue({
    assigned: 20,
    submitted: 7,
    notSubmitted: 13,
    late: 1,
  })
  vi.mocked(listTeacherSubmissions)
    .mockReset()
    .mockResolvedValue({ submissions: [] })
  vi.mocked(getTeacherSubmission).mockReset()
  vi.mocked(reviewTeacherRevision).mockReset().mockResolvedValue({})
  vi.mocked(getTeacherRubric).mockReset().mockResolvedValue({ rubric: null })
  vi.mocked(saveTeacherRubric).mockReset().mockResolvedValue({})
  vi.mocked(scoreTeacherRevision).mockReset().mockResolvedValue({})
  vi.mocked(getTeacherCourseworkAudience)
    .mockReset()
    .mockResolvedValue({
      students: [
        {
          studentId: assignmentId,
          studentReference: 'S-1',
          name: 'Student One',
        },
      ],
    })
  vi.mocked(transitionTeacherCoursework)
    .mockReset()
    .mockResolvedValue({ ...row, status: 'published' })
  vi.mocked(createTeacherCoursework).mockReset().mockResolvedValue(row)
})
afterEach(cleanup)
function show() {
  return render(
    <TeacherCourseworkWorkspace
      baseUrl="http://localhost/api"
      schoolId={schoolId}
      structure={structure}
      teachingAssignments={teachingAssignments}
      onSessionExpired={vi.fn()}
    />,
  )
}
describe('teacher coursework workspace', () => {
  it('shows scoped classes, scan state and factual submission counts', async () => {
    show()
    const selector = await screen.findByLabelText('Assignment')
    fireEvent.change(selector, { target: { value: assignmentId } })
    expect(await screen.findByText(/Assigned 20/)).toHaveProperty(
      'textContent',
      'Assigned 20 · Submitted 7 · Not submitted 13 · Late 1',
    )
    expect(screen.getByText('notes.pdf · pending')).toBeTruthy()
    expect(
      screen.getByText(/Not submitted is an operational count/),
    ).toBeTruthy()
    expect(screen.getByLabelText('Class and subject')).toHaveProperty(
      'textContent',
      'A · Science',
    )
  })
  it('publishes through an explicit action', async () => {
    show()
    fireEvent.change(await screen.findByLabelText('Assignment'), {
      target: { value: assignmentId },
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Publish' }))
    await waitFor(() =>
      expect(transitionTeacherCoursework).toHaveBeenCalledWith(
        'http://localhost/api',
        schoolId,
        assignmentId,
        'publish',
      ),
    )
  })
  it('reviews only a selected submitted revision', async () => {
    vi.mocked(listTeacherSubmissions).mockResolvedValue({
      submissions: [
        {
          id: assignmentId,
          studentId: schoolId,
          status: 'submitted',
          submittedAt: '2026-09-01T10:00:00.000Z',
          student: {
            givenName: 'Student',
            familyName: 'One',
            studentReference: 'S-1',
          },
        },
      ],
    })
    vi.mocked(getTeacherSubmission).mockResolvedValue({
      id: assignmentId,
      studentId: schoolId,
      status: 'submitted',
      submittedAt: '2026-09-01T10:00:00.000Z',
      student: {
        givenName: 'Student',
        familyName: 'One',
        studentReference: 'S-1',
      },
      revisions: [
        {
          id: assignmentId,
          revisionNumber: 1,
          textResponse: 'Synthetic answer',
          submittedAt: '2026-09-01T10:00:00.000Z',
          attachments: [],
          review: {
            status: 'pending',
            resubmissionAllowed: false,
            resubmissionDueAt: null,
          },
        },
      ],
    })
    show()
    fireEvent.change(await screen.findByLabelText('Assignment'), {
      target: { value: assignmentId },
    })
    await screen.findByRole('option', { name: /Student One/ })
    fireEvent.change(await screen.findByLabelText('Student submission'), {
      target: { value: assignmentId },
    })
    fireEvent.click(
      await screen.findByRole('button', { name: 'Mark reviewed' }),
    )
    await waitFor(() =>
      expect(reviewTeacherRevision).toHaveBeenCalledWith(
        'http://localhost/api',
        schoolId,
        assignmentId,
        assignmentId,
        { status: 'reviewed' },
      ),
    )
  })
})
