import { requestJson } from './api'

function schoolPath(schoolId: string) {
  return '/schools/' + encodeURIComponent(schoolId)
}
function json(body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }
}

export function postLearningMaterial(
  baseUrl: string,
  schoolId: string,
  input: {
    academicYearId: string
    schoolClassId: string
    subjectId: string
    title: string
    description?: string
    resourceType: 'link'
    resourceLocation: string
    publish: boolean
  },
): Promise<unknown> {
  return requestJson(baseUrl, schoolPath(schoolId) + '/materials', json(input))
}

export function postAnnouncement(
  baseUrl: string,
  schoolId: string,
  input: {
    schoolClassId?: string
    title: string
    body: string
    publish: boolean
  },
): Promise<unknown> {
  return requestJson(
    baseUrl,
    schoolPath(schoolId) + '/announcements',
    json(input),
  )
}
