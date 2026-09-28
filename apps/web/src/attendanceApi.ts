import { requestJson } from './api'

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused'
export type AttendanceSession = {
  id: string
  status: 'open' | 'submitted' | 'finalized' | 'cancelled'
  date: string
  schoolClassId: string
  subjectId: string | null
  timetablePeriodId: string | null
}
export type AttendanceRoster = {
  session: AttendanceSession
  enrollments: Array<{
    id: string
    studentId: string
    student: { givenName: string; familyName: string }
  }>
  records: Array<{
    id: string
    studentId: string
    status: AttendanceStatus
    note: string | null
  }>
  unrecordedCount: number
}
export type AttendanceHistory = {
  records: Array<{
    id: string
    date: string
    className: string
    subjectName: string | null
    status: AttendanceStatus
  }>
  nextCursor: string | null
}

const root = (schoolId: string) =>
  `/schools/${encodeURIComponent(schoolId)}/attendance`
const json = (method: 'POST' | 'PUT', body: unknown): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

export async function getAttendanceSessions(
  baseUrl: string,
  schoolId: string,
  academicYearId: string,
  schoolClassId: string,
  date: string,
) {
  const query = new URLSearchParams({ academicYearId, schoolClassId, date })
  return (await requestJson(
    baseUrl,
    `${root(schoolId)}/sessions?${query}`,
  )) as { sessions: AttendanceSession[] }
}
export async function openAttendanceSession(
  baseUrl: string,
  schoolId: string,
  body: {
    academicYearId: string
    schoolClassId: string
    date: string
    timetablePeriodId: string
    subjectId: string
    teachingAssignmentId: string
  },
) {
  return (await requestJson(
    baseUrl,
    `${root(schoolId)}/sessions`,
    json('POST', body),
  )) as AttendanceSession
}
export async function getAttendanceRoster(
  baseUrl: string,
  schoolId: string,
  sessionId: string,
) {
  return (await requestJson(
    baseUrl,
    `${root(schoolId)}/sessions/${encodeURIComponent(sessionId)}/roster`,
  )) as AttendanceRoster
}
export async function saveAttendance(
  baseUrl: string,
  schoolId: string,
  sessionId: string,
  marks: Array<{
    studentId: string
    enrollmentId: string
    status: AttendanceStatus
  }>,
) {
  return requestJson(
    baseUrl,
    `${root(schoolId)}/sessions/${encodeURIComponent(sessionId)}/records/bulk`,
    json('PUT', { marks }),
  )
}
export async function submitAttendance(
  baseUrl: string,
  schoolId: string,
  sessionId: string,
) {
  return requestJson(
    baseUrl,
    `${root(schoolId)}/sessions/${encodeURIComponent(sessionId)}/submit`,
    { method: 'POST' },
  )
}
export async function correctAttendance(
  baseUrl: string,
  schoolId: string,
  recordId: string,
  newStatus: AttendanceStatus,
  reason: string,
) {
  return requestJson(
    baseUrl,
    `${root(schoolId)}/corrections`,
    json('POST', { recordId, newStatus, reason }),
  )
}
export async function getAttendanceHistory(
  baseUrl: string,
  schoolId: string,
  studentId: string,
) {
  return (await requestJson(
    baseUrl,
    `${root(schoolId)}/students/${encodeURIComponent(studentId)}/history`,
  )) as AttendanceHistory
}
