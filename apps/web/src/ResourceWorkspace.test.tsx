import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { ResourceWorkspace } from './ResourceWorkspace'
import { getAcademicStructure, getTeachingAssignments } from './academicApi'
import { postAnnouncement, postLearningMaterial } from './resourceApi'

vi.mock('./academicApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./academicApi')>()),
  getAcademicStructure: vi.fn(),
  getTeachingAssignments: vi.fn(),
}))
vi.mock('./resourceApi', () => ({
  postAnnouncement: vi.fn(),
  postLearningMaterial: vi.fn(),
}))

const baseUrl = 'http://localhost:3000/api'
const schoolId = '123e4567-e89b-42d3-a456-426614174010'
const academicYearId = '123e4567-e89b-42d3-a456-426614174011'
const schoolClassId = '123e4567-e89b-42d3-a456-426614174012'
const subjectId = '123e4567-e89b-42d3-a456-426614174013'
const assignment = {
  id: '123e4567-e89b-42d3-a456-426614174014',
  userId: '123e4567-e89b-42d3-a456-426614174015',
  academicYearId,
  schoolClassId,
  subjectId,
}
const structure = {
  role: 'teacher' as const,
  academicYears: [
    {
      id: academicYearId,
      name: '2026',
      startsOn: '2026-09-01',
      endsOn: '2027-08-31',
    },
  ],
  classes: [
    {
      id: schoolClassId,
      academicYearId,
      name: 'Class A',
      gradeLevelName: 'Grade 1',
    },
  ],
  subjects: [{ id: subjectId, name: 'Science', code: null }],
  gradingPeriods: [],
  teachers: [],
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getAcademicStructure).mockResolvedValue(structure)
  vi.mocked(getTeachingAssignments).mockResolvedValue([assignment])
  vi.mocked(postLearningMaterial).mockResolvedValue({})
  vi.mocked(postAnnouncement).mockResolvedValue({})
})
afterEach(cleanup)

describe('staff resources', () => {
  it('creates material from a real assignment and limits teacher notices to their class', async () => {
    render(
      <ResourceWorkspace
        baseUrl={baseUrl}
        schoolId={schoolId}
        onSessionExpired={vi.fn()}
      />,
    )
    await screen.findByRole('heading', { name: 'Publish learning material' })
    fireEvent.change(screen.getAllByLabelText('Title')[0]!, {
      target: { value: 'Practice sheet' },
    })
    fireEvent.change(screen.getByLabelText('Resource URL'), {
      target: { value: 'https://school.example.test/practice' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Publish material' }))
    await waitFor(() =>
      expect(postLearningMaterial).toHaveBeenCalledWith(
        baseUrl,
        schoolId,
        expect.objectContaining({
          academicYearId,
          schoolClassId,
          subjectId,
          title: 'Practice sheet',
        }),
      ),
    )
    expect(screen.queryByRole('option', { name: 'School-wide' })).toBeNull()
    fireEvent.change(screen.getAllByLabelText('Title')[1]!, {
      target: { value: 'Class message' },
    })
    fireEvent.change(screen.getByLabelText('Message'), {
      target: { value: 'Read chapter one.' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Publish announcement' }),
    )
    await waitFor(() =>
      expect(postAnnouncement).toHaveBeenCalledWith(baseUrl, schoolId, {
        schoolClassId,
        title: 'Class message',
        body: 'Read chapter one.',
        publish: true,
      }),
    )
  })

  it('offers school-wide notices to administrators', async () => {
    vi.mocked(getAcademicStructure).mockResolvedValue({
      ...structure,
      role: 'administrator',
    })
    render(
      <ResourceWorkspace
        baseUrl={baseUrl}
        schoolId={schoolId}
        onSessionExpired={vi.fn()}
      />,
    )
    await screen.findByRole('option', { name: 'School-wide' })
    expect(
      screen.queryByRole('heading', { name: 'Publish learning material' }),
    ).toBeNull()
    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'School message' },
    })
    fireEvent.change(screen.getByLabelText('Message'), {
      target: { value: 'School opens Monday.' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Publish announcement' }),
    )
    await waitFor(() =>
      expect(postAnnouncement).toHaveBeenCalledWith(baseUrl, schoolId, {
        title: 'School message',
        body: 'School opens Monday.',
        publish: true,
      }),
    )
  })
})
