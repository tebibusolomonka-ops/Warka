import { requestJson } from './api'

export type SchoolEvent = {
  id: string
  schoolId: string
  title: string
  description: string
  startsAt: string
  endsAt: string
  schoolLocation: string | null
  status: 'draft' | 'published' | 'cancelled' | 'completed'
  rsvpEnabled: boolean
  audience?: {
    scope: string
    schoolClassId: string | null
    gradeLevelId: string | null
  } | null
  attachments?: { id: string; originalFileName: string; available: boolean }[]
}

const path = (value: string) => encodeURIComponent(value)
const root = (schoolId: string) => `/schools/${path(schoolId)}/events`
const eventPath = (schoolId: string, eventId: string) =>
  `${root(schoolId)}/${path(eventId)}`
const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

export async function listManagedEvents(baseUrl: string, schoolId: string) {
  return (await requestJson(baseUrl, `${root(schoolId)}/admin`)) as {
    events: SchoolEvent[]
  }
}
export async function createEvent(
  baseUrl: string,
  schoolId: string,
  body: {
    title: string
    description: string
    startsAt: string
    endsAt: string
    schoolLocation?: string
  },
) {
  return (await requestJson(
    baseUrl,
    root(schoolId),
    json('POST', body),
  )) as SchoolEvent
}
export async function updateEvent(
  baseUrl: string,
  schoolId: string,
  eventId: string,
  body: {
    title: string
    description: string
    startsAt: string
    endsAt: string
    schoolLocation?: string
  },
) {
  return (await requestJson(
    baseUrl,
    `${eventPath(schoolId, eventId)}/draft`,
    json('PUT', body),
  )) as SchoolEvent
}
export async function setEventAudience(
  baseUrl: string,
  schoolId: string,
  eventId: string,
  body: { scope: string; schoolClassId?: string },
) {
  return requestJson(
    baseUrl,
    `${eventPath(schoolId, eventId)}/audience`,
    json('PUT', body),
  )
}
export async function setEventRsvp(
  baseUrl: string,
  schoolId: string,
  eventId: string,
  enabled: boolean,
) {
  return requestJson(
    baseUrl,
    `${eventPath(schoolId, eventId)}/rsvp`,
    json('PUT', { enabled }),
  )
}
export async function transitionEvent(
  baseUrl: string,
  schoolId: string,
  eventId: string,
  action: 'publish' | 'cancel' | 'complete',
) {
  return requestJson(baseUrl, `${eventPath(schoolId, eventId)}/${action}`, {
    method: 'POST',
  })
}
export async function listEventAttachments(
  baseUrl: string,
  schoolId: string,
  eventId: string,
) {
  return (await requestJson(
    baseUrl,
    `${eventPath(schoolId, eventId)}/attachments/admin`,
  )) as {
    attachments: { id: string; originalFileName: string; status: string }[]
  }
}
export async function uploadEventAttachment(
  baseUrl: string,
  schoolId: string,
  eventId: string,
  file: File,
) {
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(new Error('Could not read attachment'))
    reader.readAsDataURL(file)
  })
  return requestJson(
    baseUrl,
    `${eventPath(schoolId, eventId)}/attachments`,
    json('POST', {
      originalFileName: file.name,
      contentType: file.type,
      base64,
    }),
  )
}
export async function eventResponseCounts(
  baseUrl: string,
  schoolId: string,
  eventId: string,
) {
  return requestJson(
    baseUrl,
    `${eventPath(schoolId, eventId)}/responses/counts`,
  ) as Promise<{ going: number; notGoing: number }>
}

export function eventDownloadUrl(
  baseUrl: string,
  schoolId: string,
  eventId: string,
  attachmentId: string,
) {
  return `${baseUrl}${eventPath(schoolId, eventId)}/attachments/${path(attachmentId)}/download`
}
export async function listFamilyEvents(
  baseUrl: string,
  schoolId: string,
  studentId?: string,
) {
  const route = studentId
    ? `/parent/schools/${path(schoolId)}/children/${path(studentId)}/events`
    : `/student/schools/${path(schoolId)}/events`
  return (await requestJson(baseUrl, route)) as { events: SchoolEvent[] }
}
export async function getFamilyEvent(
  baseUrl: string,
  schoolId: string,
  eventId: string,
  studentId?: string,
) {
  const route = studentId
    ? `/parent/schools/${path(schoolId)}/children/${path(studentId)}/events/${path(eventId)}`
    : `/student/schools/${path(schoolId)}/events/${path(eventId)}`
  return (await requestJson(baseUrl, route)) as SchoolEvent
}
export async function respondToFamilyEvent(
  baseUrl: string,
  schoolId: string,
  eventId: string,
  status: 'going' | 'notGoing',
  studentId?: string,
) {
  const route = studentId
    ? `/parent/schools/${path(schoolId)}/children/${path(studentId)}/events/${path(eventId)}/responses`
    : `/student/schools/${path(schoolId)}/events/${path(eventId)}/responses`
  return requestJson(baseUrl, route, json('POST', { status }))
}
