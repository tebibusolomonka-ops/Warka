import {
  ParentIdentitySchema,
  ParentChildrenSchema,
  StudentResultsSchema,
  StudentMaterialsSchema,
  StudentAnnouncementsSchema,
  SchoolParentPortalSettingSchema,
  GuardianRelationshipViewSchema,
  StudentAccountStatusSchema,
  FamilyConversationSummarySchema,
  FamilyConversationDetailSchema,
  TeacherContactSchema,
  type ParentIdentity,
  type ParentChild,
  type StudentResult,
  type StudentMaterial,
  type StudentAnnouncement,
  type SchoolParentPortalSetting,
  type GuardianRelationshipView,
  type StudentAccountStatus,
  type FamilyConversationSummary,
  type FamilyConversationDetail,
  type TeacherContact,
} from '@warka/shared'
import { requestJson } from './api'

const path = (value: string) => encodeURIComponent(value)
const schoolPath = (schoolId: string) => '/schools/' + path(schoolId)
const childPath = (reference: string) => '/parent/children/' + path(reference)
const guardianPath = (schoolId: string, studentId: string) =>
  schoolPath(schoolId) + '/students/' + path(studentId) + '/guardians'
const staffConversationPath = (schoolId: string) =>
  schoolPath(schoolId) + '/family-conversations'
const parentConversationPath = '/parent/conversations'
const json = (body: unknown, method = 'POST'): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

export async function getParentIdentity(
  baseUrl: string,
): Promise<ParentIdentity> {
  return ParentIdentitySchema.parse(await requestJson(baseUrl, '/parent/me'))
}
export async function getParentChildren(
  baseUrl: string,
): Promise<ParentChild[]> {
  return ParentChildrenSchema.parse(
    await requestJson(baseUrl, '/parent/children'),
  )
}
export async function getParentResults(
  baseUrl: string,
  reference: string,
): Promise<StudentResult[]> {
  return StudentResultsSchema.parse(
    await requestJson(baseUrl, childPath(reference) + '/results'),
  )
}
export async function getParentMaterials(
  baseUrl: string,
  reference: string,
): Promise<StudentMaterial[]> {
  return StudentMaterialsSchema.parse(
    await requestJson(baseUrl, childPath(reference) + '/materials'),
  )
}
export async function getParentAnnouncements(
  baseUrl: string,
  reference: string,
): Promise<StudentAnnouncement[]> {
  return StudentAnnouncementsSchema.parse(
    await requestJson(baseUrl, childPath(reference) + '/announcements'),
  )
}
export async function getTeacherContacts(
  baseUrl: string,
  reference: string,
): Promise<TeacherContact[]> {
  return TeacherContactSchema.array().parse(
    await requestJson(baseUrl, childPath(reference) + '/teacher-contacts'),
  )
}
export async function getSchoolParentPortalSetting(
  baseUrl: string,
  schoolId: string,
): Promise<SchoolParentPortalSetting> {
  return SchoolParentPortalSettingSchema.parse(
    await requestJson(baseUrl, schoolPath(schoolId) + '/parent-portal'),
  )
}
export async function updateSchoolParentPortalSetting(
  baseUrl: string,
  schoolId: string,
  enabled: boolean,
): Promise<SchoolParentPortalSetting> {
  return SchoolParentPortalSettingSchema.parse(
    await requestJson(
      baseUrl,
      schoolPath(schoolId) + '/parent-portal',
      json({ parentPortalEnabled: enabled }, 'PUT'),
    ),
  )
}
export async function getGuardianRelationships(
  baseUrl: string,
  schoolId: string,
  studentId: string,
): Promise<GuardianRelationshipView[]> {
  return GuardianRelationshipViewSchema.array().parse(
    await requestJson(baseUrl, guardianPath(schoolId, studentId)),
  )
}
export async function verifyGuardian(
  baseUrl: string,
  schoolId: string,
  studentId: string,
  guardianId: string,
): Promise<void> {
  await requestJson(
    baseUrl,
    guardianPath(schoolId, studentId) + '/' + path(guardianId) + '/verify',
    { method: 'POST' },
  )
}
export async function revokeGuardian(
  baseUrl: string,
  schoolId: string,
  studentId: string,
  guardianId: string,
  reason: string,
): Promise<void> {
  await requestJson(
    baseUrl,
    guardianPath(schoolId, studentId) + '/' + path(guardianId) + '/revoke',
    json({ reason }),
  )
}
export async function getGuardianAccountStatus(
  baseUrl: string,
  schoolId: string,
  guardianId: string,
): Promise<StudentAccountStatus> {
  return StudentAccountStatusSchema.parse(
    await requestJson(
      baseUrl,
      schoolPath(schoolId) + '/guardians/' + path(guardianId) + '/access',
    ),
  )
}
export async function provisionGuardianAccount(
  baseUrl: string,
  schoolId: string,
  input: {
    guardianId: string
    email: string
    displayName: string
    initialPassword: string
  },
): Promise<void> {
  await requestJson(
    baseUrl,
    schoolPath(schoolId) + '/guardians/' + path(input.guardianId) + '/access',
    json(input),
  )
}
export async function getParentConversations(
  baseUrl: string,
  limit = 20,
  offset = 0,
): Promise<FamilyConversationSummary[]> {
  return FamilyConversationSummarySchema.array().parse(
    await requestJson(
      baseUrl,
      parentConversationPath + `?limit=${limit}&offset=${offset}`,
    ),
  )
}
export async function createParentConversation(
  baseUrl: string,
  input: {
    studentReference: string
    route: 'teacher' | 'schoolOffice'
    teacherUserId?: string
    body: string
  },
): Promise<{ id: string }> {
  return (await requestJson(baseUrl, parentConversationPath, json(input))) as {
    id: string
  }
}
export async function getParentConversation(
  baseUrl: string,
  id: string,
  limit = 50,
  offset = 0,
): Promise<FamilyConversationDetail> {
  return FamilyConversationDetailSchema.parse(
    await requestJson(
      baseUrl,
      parentConversationPath +
        '/' +
        path(id) +
        `?limit=${limit}&offset=${offset}`,
    ),
  )
}
export async function sendParentMessage(
  baseUrl: string,
  id: string,
  body: string,
): Promise<void> {
  await requestJson(
    baseUrl,
    parentConversationPath + '/' + path(id) + '/messages',
    json({ body }),
  )
}
export async function getStaffConversations(
  baseUrl: string,
  schoolId: string,
  limit = 20,
  offset = 0,
): Promise<FamilyConversationSummary[]> {
  return FamilyConversationSummarySchema.array().parse(
    await requestJson(
      baseUrl,
      staffConversationPath(schoolId) + `?limit=${limit}&offset=${offset}`,
    ),
  )
}
export async function getStaffConversation(
  baseUrl: string,
  schoolId: string,
  id: string,
  limit = 50,
  offset = 0,
): Promise<FamilyConversationDetail> {
  return FamilyConversationDetailSchema.parse(
    await requestJson(
      baseUrl,
      staffConversationPath(schoolId) +
        '/' +
        path(id) +
        `?limit=${limit}&offset=${offset}`,
    ),
  )
}
export async function actOnStaffConversation(
  baseUrl: string,
  schoolId: string,
  id: string,
  action: 'close' | 'escalate',
): Promise<void> {
  await requestJson(
    baseUrl,
    staffConversationPath(schoolId) + '/' + path(id) + '/' + action,
    { method: 'POST' },
  )
}
export async function sendStaffMessage(
  baseUrl: string,
  schoolId: string,
  id: string,
  body: string,
): Promise<void> {
  await requestJson(
    baseUrl,
    staffConversationPath(schoolId) + '/' + path(id) + '/messages',
    json({ body }),
  )
}
