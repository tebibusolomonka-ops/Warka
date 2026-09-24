import { requestJson } from './api'

export type AcademicContext = {
  academicYearId: string
  gradingPeriodId: string
  schoolClassId: string
  subjectId: string
}
export type AcademicStructure = {
  role: 'administrator' | 'teacher' | 'approver'
  academicYears: {
    id: string
    name: string
    startsOn: string
    endsOn: string
  }[]
  classes: {
    id: string
    academicYearId: string
    name: string
    gradeLevelName: string
  }[]
  subjects: { id: string; name: string; code: string | null }[]
  gradingPeriods: {
    id: string
    academicYearId: string
    name: string
    startsOn: string
    endsOn: string
  }[]
  teachers: { id: string; displayName: string }[]
}
export type TeachingAssignment = {
  id: string
  userId: string
  academicYearId: string
  schoolClassId: string
  subjectId: string
}
export type Assessment = {
  id: string
  name: string
  maximumScore: string
  weight: string
  position: number
}
export type AcademicPreview = {
  status: 'draft' | 'pending' | 'published'
  complete: boolean
  resultSetId: string | null
  assessments: Assessment[]
  rows: {
    enrollmentId: string
    studentReference: string
    givenName: string
    familyName: string | null
    marks: { id: string; assessmentId: string; score: string }[]
    calculation: {
      status: 'ready' | 'incomplete_configuration' | 'missing_marks'
      percentage: string | null
      gradeLabel: string | null
      missingAssessmentIds: string[]
      configurationProblems: string[]
    }
    published: {
      id: string
      percentage: string
      gradeLabel: string
      currentPercentage: string
      currentGradeLabel: string
    } | null
  }[]
}
export type ImportReview = {
  valid: boolean
  rows: {
    line: number
    studentReference: string
    score: string
    action: 'create' | 'update'
  }[]
  problems: { line: number; code: string; studentReference?: string }[]
}
export type ResultSetSummary = {
  id: string
  status: 'pending' | 'published'
  academicYearId: string
  gradingPeriodId: string
  schoolClassId: string
  subjectId: string
  submittedBy: { displayName: string } | null
}

function schoolPath(schoolId: string) {
  return '/schools/' + encodeURIComponent(schoolId)
}

function contextQuery(context: AcademicContext) {
  return new URLSearchParams(context).toString()
}

function json(method: 'POST' | 'PUT', body: unknown): RequestInit {
  return {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }
}

export function getAcademicStructure(
  baseUrl: string,
  schoolId: string,
): Promise<AcademicStructure> {
  return requestJson(
    baseUrl,
    schoolPath(schoolId) + '/academic-structure',
  ) as Promise<AcademicStructure>
}

export function getTeachingAssignments(
  baseUrl: string,
  schoolId: string,
): Promise<TeachingAssignment[]> {
  return requestJson(
    baseUrl,
    schoolPath(schoolId) + '/teaching-assignments',
  ) as Promise<TeachingAssignment[]>
}

export function getAcademicPreview(
  baseUrl: string,
  schoolId: string,
  context: AcademicContext,
): Promise<AcademicPreview> {
  return requestJson(
    baseUrl,
    schoolPath(schoolId) + '/results/preview?' + contextQuery(context),
  ) as Promise<AcademicPreview>
}

export function saveAcademicMark(
  baseUrl: string,
  schoolId: string,
  enrollmentId: string,
  assessmentId: string,
  score: string,
  markId?: string,
): Promise<unknown> {
  return markId
    ? requestJson(
        baseUrl,
        schoolPath(schoolId) + '/marks/' + encodeURIComponent(markId),
        json('PUT', { score }),
      )
    : requestJson(
        baseUrl,
        schoolPath(schoolId) + '/marks',
        json('POST', { enrollmentId, assessmentId, score }),
      )
}

export function validateAcademicImport(
  baseUrl: string,
  schoolId: string,
  assessmentId: string,
  csv: string,
): Promise<ImportReview> {
  return requestJson(
    baseUrl,
    schoolPath(schoolId) +
      '/assessments/' +
      encodeURIComponent(assessmentId) +
      '/import/validate',
    json('POST', { csv }),
  ) as Promise<ImportReview>
}

export function applyAcademicImport(
  baseUrl: string,
  schoolId: string,
  assessmentId: string,
  csv: string,
): Promise<{ created: number; updated: number }> {
  return requestJson(
    baseUrl,
    schoolPath(schoolId) +
      '/assessments/' +
      encodeURIComponent(assessmentId) +
      '/import/apply',
    json('POST', { csv }),
  ) as Promise<{ created: number; updated: number }>
}

export function submitAcademicResults(
  baseUrl: string,
  schoolId: string,
  context: AcademicContext,
): Promise<unknown> {
  return requestJson(
    baseUrl,
    schoolPath(schoolId) + '/results/submit',
    json('POST', context),
  )
}

export function getResultSets(
  baseUrl: string,
  schoolId: string,
  status: 'pending' | 'published',
): Promise<ResultSetSummary[]> {
  return requestJson(
    baseUrl,
    schoolPath(schoolId) + '/result-sets/' + status,
  ) as Promise<ResultSetSummary[]>
}

export function publishAcademicResults(
  baseUrl: string,
  schoolId: string,
  resultSetId: string,
): Promise<unknown> {
  return requestJson(
    baseUrl,
    schoolPath(schoolId) +
      '/result-sets/' +
      encodeURIComponent(resultSetId) +
      '/publish',
    { method: 'POST' },
  )
}

export function correctAcademicResult(
  baseUrl: string,
  schoolId: string,
  publishedResultId: string,
  percentage: string,
  reason: string,
): Promise<unknown> {
  return requestJson(
    baseUrl,
    schoolPath(schoolId) +
      '/published-results/' +
      encodeURIComponent(publishedResultId) +
      '/corrections',
    json('POST', { percentage, reason }),
  )
}

export function createAcademicSubject(
  baseUrl: string,
  schoolId: string,
  name: string,
  code?: string,
): Promise<unknown> {
  return requestJson(
    baseUrl,
    schoolPath(schoolId) + '/subjects',
    json('POST', { name, ...(code ? { code } : {}) }),
  )
}

export function createAcademicPeriod(
  baseUrl: string,
  schoolId: string,
  academicYearId: string,
  name: string,
  startsOn: string,
  endsOn: string,
): Promise<unknown> {
  return requestJson(
    baseUrl,
    schoolPath(schoolId) + '/grading-periods',
    json('POST', { academicYearId, name, startsOn, endsOn }),
  )
}

export function createAcademicAssessment(
  baseUrl: string,
  schoolId: string,
  context: AcademicContext,
  name: string,
  maximumScore: string,
  weight: string,
  position: number,
): Promise<unknown> {
  return requestJson(
    baseUrl,
    schoolPath(schoolId) + '/assessments',
    json('POST', { ...context, name, maximumScore, weight, position }),
  )
}

export function createTeachingAssignment(
  baseUrl: string,
  schoolId: string,
  userId: string,
  academicYearId: string,
  schoolClassId: string,
  subjectId: string,
): Promise<unknown> {
  return requestJson(
    baseUrl,
    schoolPath(schoolId) + '/teaching-assignments',
    json('POST', { userId, academicYearId, schoolClassId, subjectId }),
  )
}

export function saveAcademicScheme(
  baseUrl: string,
  schoolId: string,
  bands: { label: string; minimumPercentage: string }[],
): Promise<unknown> {
  return requestJson(
    baseUrl,
    schoolPath(schoolId) + '/grading-scheme',
    json('PUT', { bands }),
  )
}

export function getAcademicScheme(
  baseUrl: string,
  schoolId: string,
): Promise<{ bands: { label: string; minimumPercentage: string }[] } | null> {
  return requestJson(
    baseUrl,
    schoolPath(schoolId) + '/grading-scheme',
  ) as Promise<{ bands: { label: string; minimumPercentage: string }[] } | null>
}
