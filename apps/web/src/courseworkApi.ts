import { requestJson } from './api'

export type CourseworkAssignment = {
  id: string
  schoolId: string
  academicYearId: string
  schoolClassId: string
  subjectId: string
  gradingPeriodId: string | null
  title: string
  instructions: string
  dueAt: string
  effectiveDueAt?: string
  status: 'draft' | 'published' | 'closed' | 'cancelled'
}
export type StudentCourseworkDetail = {
  assignment: CourseworkAssignment
  effectiveDueAt: string
  context: { className: string; subjectName: string; teacherName: string }
  attachments: CourseworkAttachment[]
  submission: CourseworkSubmission | null
}
export type CourseworkSubmission = {
  id: string
  status: 'draft' | 'submitted' | 'withdrawn'
  submittedAt: string | null
}
export type CourseworkRevision = {
  id: string
  revisionNumber: number
  textResponse: string
  submittedAt: string | null
  attachments: {
    id: string
    fileAsset: { originalFileName: string; status: string }
  }[]
}
const studentRoot = '/student/coursework'
const studentItem = (assignmentId: string) =>
  `${studentRoot}/${encodeURIComponent(assignmentId)}`

export async function listStudentCoursework(baseUrl: string) {
  return (await requestJson(baseUrl, studentRoot)) as {
    assignments: CourseworkAssignment[]
  }
}
export async function getStudentCoursework(
  baseUrl: string,
  assignmentId: string,
) {
  return (await requestJson(
    baseUrl,
    studentItem(assignmentId),
  )) as StudentCourseworkDetail
}
export async function getOwnCourseworkSubmission(
  baseUrl: string,
  assignmentId: string,
) {
  return (await requestJson(
    baseUrl,
    `${studentItem(assignmentId)}/submission`,
  )) as {
    submission: CourseworkSubmission | null
    revisions: CourseworkRevision[]
  }
}
export async function startStudentCoursework(
  baseUrl: string,
  assignmentId: string,
) {
  return (await requestJson(
    baseUrl,
    `${studentItem(assignmentId)}/submission`,
    json('POST', {}),
  )) as CourseworkSubmission
}
export async function saveStudentCourseworkDraft(
  baseUrl: string,
  assignmentId: string,
  textResponse: string,
) {
  return (await requestJson(
    baseUrl,
    `${studentItem(assignmentId)}/submission/draft`,
    json('PUT', { textResponse }),
  )) as CourseworkRevision
}
export async function submitStudentCoursework(
  baseUrl: string,
  assignmentId: string,
) {
  return (await requestJson(
    baseUrl,
    `${studentItem(assignmentId)}/submission/submit`,
    json('POST'),
  )) as CourseworkRevision
}
export async function withdrawStudentCoursework(
  baseUrl: string,
  assignmentId: string,
) {
  return requestJson(
    baseUrl,
    `${studentItem(assignmentId)}/submission/withdraw`,
    json('POST'),
  )
}
export async function uploadStudentCoursework(
  baseUrl: string,
  assignmentId: string,
  revisionId: string,
  file: File,
) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const base64 = btoa(
    Array.from(bytes, (value) => String.fromCharCode(value)).join(''),
  )
  return requestJson(
    baseUrl,
    `${studentItem(assignmentId)}/revisions/${encodeURIComponent(revisionId)}/attachments`,
    json('POST', {
      originalFileName: file.name,
      contentType: file.type || 'application/octet-stream',
      base64,
    }),
  )
}
export type CourseworkAttachment = {
  id: string
  originalFileName: string
  status: 'pending' | 'available' | 'quarantined' | 'rejected'
}
export type CourseworkCounts = {
  assigned: number
  submitted: number
  notSubmitted: number
  late: number
}
export type CourseworkAudience = {
  studentId: string
  studentReference: string
  name: string
}[]
const root = (schoolId: string) =>
  `/schools/${encodeURIComponent(schoolId)}/coursework`
const item = (schoolId: string, assignmentId: string) =>
  `${root(schoolId)}/${encodeURIComponent(assignmentId)}`
const json = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
})

export async function listTeacherCoursework(baseUrl: string, schoolId: string) {
  return (await requestJson(baseUrl, root(schoolId))) as {
    assignments: CourseworkAssignment[]
  }
}
export async function getTeacherCoursework(
  baseUrl: string,
  schoolId: string,
  assignmentId: string,
) {
  return (await requestJson(baseUrl, item(schoolId, assignmentId))) as {
    assignment: CourseworkAssignment
    attachments: CourseworkAttachment[]
  }
}
export async function createTeacherCoursework(
  baseUrl: string,
  schoolId: string,
  input: {
    academicYearId: string
    gradingPeriodId?: string
    schoolClassId: string
    subjectId: string
    title: string
    instructions: string
    dueAt: string
  },
) {
  return (await requestJson(
    baseUrl,
    root(schoolId),
    json('POST', input),
  )) as CourseworkAssignment
}
export async function editTeacherCoursework(
  baseUrl: string,
  schoolId: string,
  assignmentId: string,
  input: { title: string; instructions: string; dueAt: string },
) {
  return (await requestJson(
    baseUrl,
    `${item(schoolId, assignmentId)}/draft`,
    json('PATCH', input),
  )) as CourseworkAssignment
}
export async function transitionTeacherCoursework(
  baseUrl: string,
  schoolId: string,
  assignmentId: string,
  action: 'publish' | 'close' | 'cancel',
) {
  return (await requestJson(
    baseUrl,
    `${item(schoolId, assignmentId)}/${action}`,
    json('POST'),
  )) as CourseworkAssignment
}
export async function uploadTeacherCoursework(
  baseUrl: string,
  schoolId: string,
  assignmentId: string,
  file: File,
) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const base64 = btoa(
    Array.from(bytes, (value) => String.fromCharCode(value)).join(''),
  )
  return requestJson(
    baseUrl,
    `${item(schoolId, assignmentId)}/attachments`,
    json('POST', {
      originalFileName: file.name,
      contentType: file.type || 'application/octet-stream',
      base64,
    }),
  )
}
export async function getTeacherCourseworkCounts(
  baseUrl: string,
  schoolId: string,
  assignmentId: string,
) {
  return (await requestJson(
    baseUrl,
    `${item(schoolId, assignmentId)}/counts`,
  )) as CourseworkCounts
}
export async function getTeacherCourseworkAudience(
  baseUrl: string,
  schoolId: string,
  assignmentId: string,
) {
  return (await requestJson(
    baseUrl,
    `${item(schoolId, assignmentId)}/audience`,
  )) as { students: CourseworkAudience }
}
export async function grantTeacherCourseworkExtension(
  baseUrl: string,
  schoolId: string,
  assignmentId: string,
  studentId: string,
  extendedDueAt: string,
  reason: string,
) {
  return requestJson(
    baseUrl,
    `${item(schoolId, assignmentId)}/extensions`,
    json('POST', { studentId, extendedDueAt, reason }),
  )
}
