import { requestJson } from './api'

export type Meeting = {
  id: string
  studentId: string
  teacherId: string
  topic: string
  status: 'requested' | 'scheduled' | 'declined' | 'cancelled' | 'completed'
  scheduledStartAt: string | null
  scheduledEndAt: string | null
  meetingMethod: 'inPerson' | 'phone' | 'online' | null
  schoolLocation: string | null
  student?: { givenName: string; familyName: string | null }
}
export type MeetingSlot = {
  id: string
  startsAt: string
  endsAt: string
  method: 'inPerson' | 'phone' | 'online'
}
const root = (schoolId: string) =>
  `/schools/${encodeURIComponent(schoolId)}/meetings`
const request = (method: string, data?: unknown): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json' },
  ...(data === undefined ? {} : { body: JSON.stringify(data) }),
})

export async function listTeacherMeetings(baseUrl: string, schoolId: string) {
  return (await requestJson(baseUrl, root(schoolId))) as {
    meetings: Meeting[]
    nextCursor: string | null
  }
}
export async function listTeacherMeetingSlots(
  baseUrl: string,
  schoolId: string,
) {
  return (await requestJson(baseUrl, `${root(schoolId)}/availability`)) as {
    slots: MeetingSlot[]
  }
}
export async function addTeacherMeetingSlot(
  baseUrl: string,
  schoolId: string,
  input: { startsAt: string; endsAt: string; method: MeetingSlot['method'] },
) {
  return requestJson(
    baseUrl,
    `${root(schoolId)}/availability`,
    request('POST', input),
  )
}
export async function closeTeacherMeetingSlot(
  baseUrl: string,
  schoolId: string,
  slotId: string,
) {
  return requestJson(
    baseUrl,
    `${root(schoolId)}/availability/${encodeURIComponent(slotId)}/close`,
    request('POST'),
  )
}
export async function scheduleTeacherMeeting(
  baseUrl: string,
  schoolId: string,
  meetingId: string,
  availabilityId: string,
  schoolLocation?: string,
) {
  return requestJson(
    baseUrl,
    `${root(schoolId)}/${encodeURIComponent(meetingId)}/schedule`,
    request('POST', {
      availabilityId,
      ...(schoolLocation ? { schoolLocation } : {}),
    }),
  )
}
export async function declineTeacherMeeting(
  baseUrl: string,
  schoolId: string,
  meetingId: string,
  reason: string,
) {
  return requestJson(
    baseUrl,
    `${root(schoolId)}/${encodeURIComponent(meetingId)}/decline`,
    request('POST', { reason }),
  )
}
export async function completeTeacherMeeting(
  baseUrl: string,
  schoolId: string,
  meetingId: string,
) {
  return requestJson(
    baseUrl,
    `${root(schoolId)}/${encodeURIComponent(meetingId)}/complete`,
    request('POST'),
  )
}
export async function listMeetingEvents(
  baseUrl: string,
  schoolId: string,
  meetingId: string,
  parent = false,
) {
  return (await requestJson(
    baseUrl,
    `${parent ? '/parent' : ''}${root(schoolId)}/${encodeURIComponent(meetingId)}/history`,
  )) as {
    events: {
      kind: string
      reason: string | null
      previousStartAt: string | null
      newStartAt: string | null
      createdAt: string
    }[]
  }
}
