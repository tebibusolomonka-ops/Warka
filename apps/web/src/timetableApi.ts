import { requestJson } from './api'

export type TimetablePeriod = {
  id: string
  name: string
  startTime: string
  endTime: string
  sortOrder: number
  instructional: boolean
}
export type SchoolCalendarDay = {
  id: string
  date: string
  dayType: 'instructional' | 'holiday' | 'closure' | 'examination' | 'staffDay'
  label: string | null
}
export type ClassTimetable = {
  id: string
  status: 'draft' | 'published' | 'archived'
  academicYearId: string
  schoolClassId: string
  publishedAt: string | null
}
export type ClassTimetableEntry = {
  id: string
  schoolClassId: string
  subjectId: string
  teachingAssignmentId: string
  timetablePeriodId: string
  weekday: number
  subject: { id: string; name: string }
  timetablePeriod: TimetablePeriod
  teachingAssignment: { userId: string }
  schoolClass?: { id: string; name: string }
}
export type TimetableProblem = {
  code: string
  entryId: string
}

function path(schoolId: string) {
  return `/schools/${encodeURIComponent(schoolId)}`
}
function json(method: 'POST' | 'PUT', body: unknown): RequestInit {
  return {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }
}
export async function getTimetablePeriods(baseUrl: string, schoolId: string) {
  const result = (await requestJson(
    baseUrl,
    `${path(schoolId)}/timetable/periods`,
  )) as { periods: TimetablePeriod[] }
  return result.periods
}
export async function addTimetablePeriod(
  baseUrl: string,
  schoolId: string,
  value: Omit<TimetablePeriod, 'id'>,
) {
  return requestJson(
    baseUrl,
    `${path(schoolId)}/timetable/periods`,
    json('POST', value),
  )
}
export async function getSchoolCalendarDays(
  baseUrl: string,
  schoolId: string,
  academicYearId: string,
) {
  const result = (await requestJson(
    baseUrl,
    `${path(schoolId)}/timetable/calendar-days?academicYearId=${encodeURIComponent(academicYearId)}`,
  )) as { days: SchoolCalendarDay[] }
  return result.days
}
export async function addSchoolCalendarDay(
  baseUrl: string,
  schoolId: string,
  value: {
    academicYearId: string
    date: string
    dayType: SchoolCalendarDay['dayType']
    label: string | null
  },
) {
  return requestJson(
    baseUrl,
    `${path(schoolId)}/timetable/calendar-days`,
    json('POST', value),
  )
}
export async function getClassTimetables(
  baseUrl: string,
  schoolId: string,
  academicYearId: string,
  schoolClassId: string,
) {
  const query = new URLSearchParams({ academicYearId, schoolClassId })
  const result = (await requestJson(
    baseUrl,
    `${path(schoolId)}/timetables?${query}`,
  )) as { timetables: ClassTimetable[] }
  return result.timetables
}
export async function createTimetableDraft(
  baseUrl: string,
  schoolId: string,
  academicYearId: string,
  schoolClassId: string,
) {
  return requestJson(
    baseUrl,
    `${path(schoolId)}/timetables`,
    json('POST', { academicYearId, schoolClassId }),
  ) as Promise<ClassTimetable>
}
export async function getClassTimetable(
  baseUrl: string,
  schoolId: string,
  planId: string,
) {
  return requestJson(
    baseUrl,
    `${path(schoolId)}/timetables/${encodeURIComponent(planId)}`,
  ) as Promise<{ plan: ClassTimetable; entries: ClassTimetableEntry[] }>
}
export async function addClassTimetableEntry(
  baseUrl: string,
  schoolId: string,
  planId: string,
  value: {
    subjectId: string
    teachingAssignmentId: string
    timetablePeriodId: string
    weekday: number
  },
) {
  return requestJson(
    baseUrl,
    `${path(schoolId)}/timetables/${encodeURIComponent(planId)}/entries`,
    json('POST', value),
  )
}
export async function removeClassTimetableEntry(
  baseUrl: string,
  schoolId: string,
  planId: string,
  entryId: string,
) {
  return requestJson(
    baseUrl,
    `${path(schoolId)}/timetables/${encodeURIComponent(planId)}/entries/${encodeURIComponent(entryId)}`,
    { method: 'DELETE' },
  )
}
export async function validateClassTimetable(
  baseUrl: string,
  schoolId: string,
  planId: string,
) {
  const result = (await requestJson(
    baseUrl,
    `${path(schoolId)}/timetables/${encodeURIComponent(planId)}/validation`,
  )) as { problems: TimetableProblem[] }
  return result.problems
}
export async function transitionClassTimetable(
  baseUrl: string,
  schoolId: string,
  planId: string,
  action: 'publish' | 'archive',
) {
  return requestJson(
    baseUrl,
    `${path(schoolId)}/timetables/${encodeURIComponent(planId)}/${action}`,
    { method: 'POST' },
  )
}
export async function getOwnTeacherTimetable(
  baseUrl: string,
  schoolId: string,
  academicYearId: string,
) {
  const result = (await requestJson(
    baseUrl,
    `${path(schoolId)}/timetable/me?academicYearId=${encodeURIComponent(academicYearId)}`,
  )) as { entries: ClassTimetableEntry[] }
  return result.entries
}
export async function getOwnTeacherCalendarDays(
  baseUrl: string,
  schoolId: string,
  academicYearId: string,
) {
  const result = (await requestJson(
    baseUrl,
    `${path(schoolId)}/timetable/me/calendar-days?academicYearId=${encodeURIComponent(academicYearId)}`,
  )) as { days: SchoolCalendarDay[] }
  return result.days
}
