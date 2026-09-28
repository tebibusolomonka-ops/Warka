import { requestJson } from './api'

export type AssessmentRoom = {
  id: string
  name: string
  code: string
  capacity: number | null
  active: boolean
}
export type AssessmentSchedule = {
  id: string
  academicYearId: string
  gradingPeriodId: string
  schoolClassId: string
  subjectId: string
  assessmentId: string
  roomId: string | null
  scheduledDate: string
  startTime: string
  endTime: string
  status: 'draft' | 'scheduled' | 'completed' | 'cancelled'
  assessment: { name: string }
  room: { name: string; capacity: number | null } | null
  sessions: {
    id: string
    status: 'planned' | 'open' | 'completed' | 'cancelled'
  }[]
}
export type ScheduleIssue = { code: string; conflictingScheduleId?: string }
export type MakeUpRequest = {
  id: string
  originalParticipationId: string
  studentId: string
  reason: string
  status:
    | 'requested'
    | 'approved'
    | 'scheduled'
    | 'completed'
    | 'rejected'
    | 'cancelled'
}
export type AssessmentRosterRow = {
  studentId: string
  reference: string
  name: string
  participation: { id: string; status: 'present' | 'absent' | 'excused' } | null
}

const path = (schoolId: string) => `/schools/${encodeURIComponent(schoolId)}`
const json = (method: 'POST' | 'PATCH', body?: unknown): RequestInit => ({
  method,
  ...(body === undefined
    ? {}
    : {
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
})

export async function getAssessmentRooms(baseUrl: string, schoolId: string) {
  const result = (await requestJson(
    baseUrl,
    `${path(schoolId)}/assessment-rooms`,
  )) as { rooms: AssessmentRoom[] }
  return result.rooms
}
export async function createRoom(
  baseUrl: string,
  schoolId: string,
  room: { name: string; code: string; capacity?: number },
) {
  return requestJson(
    baseUrl,
    `${path(schoolId)}/assessment-rooms`,
    json('POST', room),
  )
}
export async function getAssessmentSchedules(
  baseUrl: string,
  schoolId: string,
  academicYearId?: string,
) {
  const query = academicYearId
    ? `?academicYearId=${encodeURIComponent(academicYearId)}`
    : ''
  const result = (await requestJson(
    baseUrl,
    `${path(schoolId)}/assessment-schedules${query}`,
  )) as { schedules: AssessmentSchedule[] }
  return result.schedules
}
export async function createSchedule(
  baseUrl: string,
  schoolId: string,
  value: {
    academicYearId: string
    gradingPeriodId: string
    schoolClassId: string
    subjectId: string
    assessmentId: string
    roomId?: string
    scheduledDate: string
    startTime: string
    endTime: string
  },
) {
  return requestJson(
    baseUrl,
    `${path(schoolId)}/assessment-schedules`,
    json('POST', value),
  )
}
export async function validateSchedule(
  baseUrl: string,
  schoolId: string,
  scheduleId: string,
) {
  return requestJson(
    baseUrl,
    `${path(schoolId)}/assessment-schedules/${encodeURIComponent(scheduleId)}/validation`,
  ) as Promise<{ valid: boolean; issues: ScheduleIssue[] }>
}
export async function transitionSchedule(
  baseUrl: string,
  schoolId: string,
  scheduleId: string,
  action: 'schedule' | 'cancel' | 'session',
) {
  return requestJson(
    baseUrl,
    `${path(schoolId)}/assessment-schedules/${encodeURIComponent(scheduleId)}/${action}`,
    json('POST'),
  )
}
export async function transitionSession(
  baseUrl: string,
  schoolId: string,
  sessionId: string,
  action: 'open' | 'complete',
) {
  return requestJson(
    baseUrl,
    `${path(schoolId)}/assessment-sessions/${encodeURIComponent(sessionId)}/${action}`,
    json('POST'),
  )
}
export async function getAssessmentRoster(
  baseUrl: string,
  schoolId: string,
  sessionId: string,
) {
  const result = (await requestJson(
    baseUrl,
    `${path(schoolId)}/assessment-sessions/${encodeURIComponent(sessionId)}/roster`,
  )) as { students: AssessmentRosterRow[] }
  return result.students
}
export async function recordParticipation(
  baseUrl: string,
  schoolId: string,
  sessionId: string,
  studentId: string,
  status: 'present' | 'absent' | 'excused',
) {
  return requestJson(
    baseUrl,
    `${path(schoolId)}/assessment-sessions/${encodeURIComponent(sessionId)}/participation`,
    json('POST', { studentId, status }),
  )
}
export async function assignInvigilator(
  baseUrl: string,
  schoolId: string,
  sessionId: string,
  userId: string,
) {
  return requestJson(
    baseUrl,
    `${path(schoolId)}/assessment-sessions/${encodeURIComponent(sessionId)}/invigilators`,
    json('POST', { userId }),
  )
}
export async function getMakeUps(baseUrl: string, schoolId: string) {
  const result = (await requestJson(
    baseUrl,
    `${path(schoolId)}/make-up-assessments`,
  )) as { requests: MakeUpRequest[] }
  return result.requests
}
export async function requestMakeUp(
  baseUrl: string,
  schoolId: string,
  originalParticipationId: string,
  reason: string,
) {
  return requestJson(
    baseUrl,
    `${path(schoolId)}/make-up-assessments`,
    json('POST', { originalParticipationId, reason }),
  )
}
export async function reviewMakeUp(
  baseUrl: string,
  schoolId: string,
  makeUpId: string,
  decision: 'approved' | 'rejected',
) {
  return requestJson(
    baseUrl,
    `${path(schoolId)}/make-up-assessments/${encodeURIComponent(makeUpId)}/review`,
    json('POST', { decision }),
  )
}
export async function scheduleMakeUp(
  baseUrl: string,
  schoolId: string,
  makeUpId: string,
  value: { scheduledDate: string; startTime: string; endTime: string },
) {
  return requestJson(
    baseUrl,
    `${path(schoolId)}/make-up-assessments/${encodeURIComponent(makeUpId)}/schedule`,
    json('POST', value),
  )
}
