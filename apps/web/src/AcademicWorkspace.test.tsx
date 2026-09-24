import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { AcademicWorkspace } from './AcademicWorkspace'
import {
  applyAcademicImport,
  correctAcademicResult,
  createAcademicSubject,
  getAcademicPreview,
  getAcademicScheme,
  getAcademicStructure,
  getResultSets,
  getTeachingAssignments,
  publishAcademicResults,
  saveAcademicMark,
  submitAcademicResults,
  validateAcademicImport,
  type AcademicPreview,
  type AcademicStructure,
} from './academicApi'

vi.mock('./academicApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./academicApi')>()
  return {
    ...actual,
    applyAcademicImport: vi.fn(),
    correctAcademicResult: vi.fn(),
    createAcademicSubject: vi.fn(),
    getAcademicPreview: vi.fn(),
    getAcademicScheme: vi.fn(),
    getAcademicStructure: vi.fn(),
    getResultSets: vi.fn(),
    getTeachingAssignments: vi.fn(),
    publishAcademicResults: vi.fn(),
    saveAcademicMark: vi.fn(),
    submitAcademicResults: vi.fn(),
    validateAcademicImport: vi.fn(),
  }
})

const baseUrl = 'http://localhost:3000/api'
const schoolId = '123e4567-e89b-42d3-a456-426614174010'
const academicYearId = '123e4567-e89b-42d3-a456-426614174011'
const schoolClassId = '123e4567-e89b-42d3-a456-426614174012'
const subjectId = '123e4567-e89b-42d3-a456-426614174013'
const gradingPeriodId = '123e4567-e89b-42d3-a456-426614174014'
const assessmentId = '123e4567-e89b-42d3-a456-426614174015'
const enrollmentId = '123e4567-e89b-42d3-a456-426614174016'
const resultSetId = '123e4567-e89b-42d3-a456-426614174017'
const publishedResultId = '123e4567-e89b-42d3-a456-426614174018'
const structure: AcademicStructure = {
  role: 'teacher',
  academicYears: [
    {
      id: academicYearId,
      name: '2026',
      startsOn: '2026-09-01',
      endsOn: '2027-08-31',
    },
  ],
  classes: [
    { id: schoolClassId, academicYearId, name: 'A', gradeLevelName: 'Grade 1' },
  ],
  subjects: [{ id: subjectId, name: 'Science', code: null }],
  gradingPeriods: [
    {
      id: gradingPeriodId,
      academicYearId,
      name: 'Term 1',
      startsOn: '2026-09-01',
      endsOn: '2027-01-31',
    },
  ],
  teachers: [],
}
const assignment = {
  id: '123e4567-e89b-42d3-a456-426614174019',
  userId: '123e4567-e89b-42d3-a456-426614174020',
  academicYearId,
  schoolClassId,
  subjectId,
}
const preview: AcademicPreview = {
  status: 'draft',
  complete: false,
  resultSetId: null,
  assessments: [
    {
      id: assessmentId,
      name: 'Quiz',
      maximumScore: '20.00',
      weight: '100.00',
      position: 0,
    },
  ],
  rows: [
    {
      enrollmentId,
      studentReference: 'WKA-SYNTHETIC',
      givenName: 'Sample',
      familyName: 'Student',
      marks: [],
      calculation: {
        status: 'missing_marks',
        percentage: null,
        gradeLabel: null,
        missingAssessmentIds: [assessmentId],
        configurationProblems: [],
      },
      published: null,
    },
  ],
}
const resultSet = {
  id: resultSetId,
  status: 'pending' as const,
  academicYearId,
  gradingPeriodId,
  schoolClassId,
  subjectId,
  submittedBy: { displayName: 'Sample Teacher' },
}
const onSessionExpired = vi.fn()

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getAcademicStructure).mockResolvedValue(structure)
  vi.mocked(getTeachingAssignments).mockResolvedValue([assignment])
  vi.mocked(getAcademicPreview).mockResolvedValue(preview)
  vi.mocked(getResultSets).mockResolvedValue([])
  vi.mocked(getAcademicScheme).mockResolvedValue(null)
  vi.mocked(saveAcademicMark).mockResolvedValue({})
  vi.mocked(validateAcademicImport).mockResolvedValue({
    valid: true,
    rows: [
      {
        line: 2,
        studentReference: 'WKA-SYNTHETIC',
        score: '12.00',
        action: 'create',
      },
    ],
    problems: [],
  })
  vi.mocked(applyAcademicImport).mockResolvedValue({ created: 1, updated: 0 })
  vi.mocked(submitAcademicResults).mockResolvedValue({})
  vi.mocked(publishAcademicResults).mockResolvedValue({})
  vi.mocked(correctAcademicResult).mockResolvedValue({})
  vi.mocked(createAcademicSubject).mockResolvedValue({})
})
afterEach(() => cleanup())

function show() {
  return render(
    <AcademicWorkspace
      baseUrl={baseUrl}
      schoolId={schoolId}
      schoolName="Sample school"
      onSessionExpired={onSessionExpired}
    />,
  )
}

describe('academic workspace', () => {
  it('shows loading and empty assignments without inventing student data', async () => {
    vi.mocked(getTeachingAssignments).mockResolvedValue([])
    show()
    expect(screen.getByRole('status').textContent).toBe(
      'Loading academic workspace',
    )
    await screen.findByText(
      'No teaching assignments are available for this account.',
    )
    expect(
      screen.queryByText('Student marks and calculated outcomes'),
    ).toBeNull()
  })

  it('validates draft scores and saves through the real academic endpoint client', async () => {
    show()
    const input = await screen.findByLabelText('Quiz score for WKA-SYNTHETIC')
    fireEvent.change(input, { target: { value: '21' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Invalid score')).toBeTruthy()
    expect(saveAcademicMark).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: '12' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(saveAcademicMark).toHaveBeenCalledWith(
        baseUrl,
        schoolId,
        enrollmentId,
        assessmentId,
        '12',
        undefined,
      ),
    )
    expect(await screen.findByText('Saved')).toBeTruthy()
  })

  it('requires CSV review before applying and shows row problems', async () => {
    vi.mocked(validateAcademicImport)
      .mockResolvedValueOnce({
        valid: false,
        rows: [],
        problems: [
          { line: 2, code: 'UNKNOWN_STUDENT', studentReference: 'WKA-UNKNOWN' },
        ],
      })
      .mockResolvedValueOnce({
        valid: true,
        rows: [
          {
            line: 2,
            studentReference: 'WKA-SYNTHETIC',
            score: '12.00',
            action: 'create',
          },
        ],
        problems: [],
      })
    show()
    await screen.findByText('Import marks from CSV')
    const file = new File(
      ['studentReference,score\nWKA-SYNTHETIC,12'],
      'marks.csv',
      { type: 'text/csv' },
    )
    Object.defineProperty(file, 'text', {
      value: async () => 'studentReference,score\nWKA-SYNTHETIC,12',
    })
    fireEvent.change(screen.getByLabelText('CSV file'), {
      target: { files: [file] },
    })
    fireEvent.click(
      await screen.findByRole('button', { name: 'Validate import' }),
    )
    expect(
      await screen.findByText('Line 2: UNKNOWN_STUDENT · WKA-UNKNOWN'),
    ).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: 'Apply reviewed import' }),
    ).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Validate import' }))
    fireEvent.click(
      await screen.findByRole('button', { name: 'Apply reviewed import' }),
    )
    await waitFor(() =>
      expect(applyAcademicImport).toHaveBeenCalledWith(
        baseUrl,
        schoolId,
        assessmentId,
        'studentReference,score\nWKA-SYNTHETIC,12',
      ),
    )
  })

  it('shows missing marks, then submits a complete preview and locks pending marks', async () => {
    show()
    await screen.findByText('Missing 1 mark(s)')
    expect(
      screen.queryByRole('button', { name: 'Submit results for review' }),
    ).toBeNull()
    cleanup()
    vi.mocked(getAcademicPreview).mockResolvedValue({
      ...preview,
      status: 'draft',
      complete: true,
      rows: [
        {
          ...preview.rows[0]!,
          calculation: {
            status: 'ready',
            percentage: '60.00',
            gradeLabel: 'Pass',
            missingAssessmentIds: [],
            configurationProblems: [],
          },
        },
      ],
    })
    show()
    fireEvent.click(
      await screen.findByRole('button', { name: 'Submit results for review' }),
    )
    await waitFor(() =>
      expect(submitAcademicResults).toHaveBeenCalledWith(baseUrl, schoolId, {
        academicYearId,
        gradingPeriodId,
        schoolClassId,
        subjectId,
      }),
    )
    cleanup()
    vi.mocked(getAcademicPreview).mockResolvedValue({
      ...preview,
      status: 'pending',
    })
    show()
    await screen.findByText('Result status:')
    expect(screen.queryByLabelText('Quiz score for WKA-SYNTHETIC')).toBeNull()
  })

  it('lets approvers review and publish pending sets, then correct published snapshots', async () => {
    vi.mocked(getAcademicStructure).mockResolvedValue({
      ...structure,
      role: 'approver',
    })
    vi.mocked(getTeachingAssignments).mockResolvedValue([])
    vi.mocked(getResultSets).mockImplementation(
      async (_base, _school, status) =>
        status === 'pending' ? [resultSet] : [],
    )
    vi.mocked(getAcademicPreview).mockResolvedValue({
      ...preview,
      status: 'pending',
      complete: true,
    })
    show()
    fireEvent.click(
      await screen.findByRole('button', {
        name: /Review Grade 1 A · Science · Term 1/,
      }),
    )
    fireEvent.click(
      await screen.findByRole('button', { name: 'Publish results' }),
    )
    await waitFor(() =>
      expect(publishAcademicResults).toHaveBeenCalledWith(
        baseUrl,
        schoolId,
        resultSetId,
      ),
    )
    cleanup()
    vi.mocked(getResultSets).mockImplementation(
      async (_base, _school, status) =>
        status === 'published' ? [{ ...resultSet, status: 'published' }] : [],
    )
    vi.mocked(getAcademicPreview).mockResolvedValue({
      ...preview,
      status: 'published',
      rows: [
        {
          ...preview.rows[0]!,
          published: {
            id: publishedResultId,
            percentage: '60.00',
            gradeLabel: 'Pass',
            currentPercentage: '60.00',
            currentGradeLabel: 'Pass',
          },
        },
      ],
    })
    show()
    fireEvent.click(
      await screen.findByRole('button', {
        name: /Open Grade 1 A · Science · Term 1/,
      }),
    )
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Correct result for WKA-SYNTHETIC',
      }),
    )
    fireEvent.change(screen.getByLabelText('Corrected percentage'), {
      target: { value: '88' },
    })
    fireEvent.change(screen.getByLabelText('Reason'), {
      target: { value: 'Verified correction' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Record correction' }))
    await waitFor(() =>
      expect(correctAcademicResult).toHaveBeenCalledWith(
        baseUrl,
        schoolId,
        publishedResultId,
        '88',
        'Verified correction',
      ),
    )
  })

  it('shows administrator setup and reports network failures', async () => {
    vi.mocked(getAcademicStructure).mockResolvedValue({
      ...structure,
      role: 'administrator',
    })
    show()
    await screen.findByText('Academic setup')
    fireEvent.change(screen.getByLabelText('Subject name'), {
      target: { value: 'Language' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add subject' }))
    await waitFor(() =>
      expect(createAcademicSubject).toHaveBeenCalledWith(
        baseUrl,
        schoolId,
        'Language',
        undefined,
      ),
    )
    cleanup()
    vi.mocked(getAcademicStructure).mockRejectedValue(new Error('offline'))
    show()
    await screen.findByText('Could not load academic workspace.')
    const beforeRetry = vi.mocked(getAcademicStructure).mock.calls.length
    fireEvent.click(
      screen.getByRole('button', { name: 'Retry academic workspace' }),
    )
    await waitFor(() =>
      expect(vi.mocked(getAcademicStructure).mock.calls.length).toBeGreaterThan(
        beforeRetry,
      ),
    )
  })
})
