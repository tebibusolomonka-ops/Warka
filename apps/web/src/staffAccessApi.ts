import { z } from 'zod'
import { requestJson } from './api'

const id = z.uuid()
const period = z.object({
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().nullable(),
  periodStatus: z.enum(['active', 'future', 'expired']),
})
const membership = period.extend({
  role: z.string(),
})
const assignment = period.extend({
  id,
  academicYearId: id,
  schoolClassId: id,
  subjectId: id,
})
const staff = z.object({
  id,
  email: z.email(),
  displayName: z.string(),
  accountStatus: z.enum(['active', 'suspended', 'deactivated']),
  organizationMembership: membership.nullable(),
  schoolMembership: membership.nullable(),
  teachingAssignments: z.array(assignment),
})
const page = z.object({
  canManageOrganization: z.boolean(),
  total: z.number().int(),
  take: z.number().int(),
  skip: z.number().int(),
  items: z.array(staff),
})
export type StaffAccess = z.infer<typeof staff>
export type StaffAccessPage = z.infer<typeof page>

const path = (schoolId: string) =>
  `/schools/${encodeURIComponent(schoolId)}/staff-access`
export async function getStaffAccess(
  baseUrl: string,
  schoolId: string,
  skip = 0,
) {
  return page.parse(
    await requestJson(baseUrl, `${path(schoolId)}?take=25&skip=${skip}`),
  )
}
export async function changeStaffStatus(
  baseUrl: string,
  schoolId: string,
  userId: string,
  status: 'active' | 'suspended' | 'deactivated',
  reason: string,
) {
  await requestJson(
    baseUrl,
    `${path(schoolId)}/${encodeURIComponent(userId)}/status`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status, reason }),
    },
  )
}
export async function offboardStaffAccess(
  baseUrl: string,
  schoolId: string,
  userId: string,
  reason: string,
  endOrganizationMembership: boolean,
) {
  await requestJson(
    baseUrl,
    `${path(schoolId)}/${encodeURIComponent(userId)}/offboard`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason, endOrganizationMembership }),
    },
  )
}
