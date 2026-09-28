import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { StudentCourseworkWorkspace } from './StudentCourseworkWorkspace'
import {
  getOwnCourseworkSubmission,
  getStudentCoursework,
  listStudentCoursework,
} from './courseworkApi'

vi.mock('./courseworkApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./courseworkApi')>()),
  getOwnCourseworkSubmission: vi.fn(),
  getStudentCoursework: vi.fn(),
  listStudentCoursework: vi.fn(),
}))
const assignmentId = '00000000-0000-4000-8000-000000000001'
const schoolId = '00000000-0000-4000-8000-000000000002'
const assignment = {
  id: assignmentId,
  schoolId,
  academicYearId: schoolId,
  schoolClassId: schoolId,
  subjectId: schoolId,
  gradingPeriodId: null,
  title: 'Read chapter',
  instructions: 'Write a response',
  dueAt: '2026-11-01T12:00:00.000Z',
  status: 'published' as const,
}
const detail = {
  assignment,
  effectiveDueAt: '2026-11-05T12:00:00.000Z',
  context: {
    className: 'A',
    subjectName: 'Science',
    teacherName: 'Teacher One',
  },
  attachments: [
    {
      id: assignmentId,
      originalFileName: 'notes.pdf',
      status: 'available' as const,
    },
  ],
  submission: null,
}
beforeEach(() => {
  vi.mocked(listStudentCoursework)
    .mockReset()
    .mockResolvedValue({ assignments: [assignment] })
  vi.mocked(getStudentCoursework).mockReset().mockResolvedValue(detail)
  vi.mocked(getOwnCourseworkSubmission)
    .mockReset()
    .mockResolvedValue({ submission: null, revisions: [] })
})
afterEach(cleanup)
function show() {
  return render(
    <StudentCourseworkWorkspace
      baseUrl="http://localhost/api"
      onSessionExpired={vi.fn()}
    />,
  )
}
describe('student coursework workspace', () => {
  it('shows personal extension and authorized attachment without inferring a grade', async () => {
    show()
    fireEvent.click(await screen.findByRole('button', { name: 'Read chapter' }))
    expect(await screen.findByText(/Personal extension/)).toBeTruthy()
    expect(screen.getByText('Status: Not started')).toBeTruthy()
    expect(
      screen.getByRole('link', { name: 'notes.pdf' }).getAttribute('href'),
    ).toContain(`/schools/${schoolId}/coursework/${assignmentId}/attachments/`)
    expect(screen.queryByText(/score|failed|risk/i)).toBeNull()
  })
  it('shows late from submittedAt and the effective due time, independent of scan completion', async () => {
    vi.mocked(getOwnCourseworkSubmission).mockResolvedValue({
      submission: {
        id: assignmentId,
        status: 'submitted',
        submittedAt: '2026-11-06T10:00:00.000Z',
      },
      revisions: [
        {
          id: assignmentId,
          revisionNumber: 1,
          textResponse: 'Response',
          submittedAt: '2026-11-06T10:00:00.000Z',
          attachments: [
            {
              id: assignmentId,
              fileAsset: {
                originalFileName: 'response.txt',
                status: 'pending',
              },
            },
          ],
        },
      ],
    })
    show()
    fireEvent.click(await screen.findByRole('button', { name: 'Read chapter' }))
    await waitFor(() => expect(screen.getByText('Status: Late')).toBeTruthy())
    expect(screen.getByText('response.txt · pending')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'response.txt' })).toBeNull()
  })
})
