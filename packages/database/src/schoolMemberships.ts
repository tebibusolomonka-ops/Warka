import {
  Prisma,
  type PrismaClient,
  type School,
  type SchoolMembership,
  type SchoolRole,
  type User,
} from '@prisma/client'
import { z } from 'zod'
import { recordAuditEvent } from './auditEvents.js'
import {
  effectiveMembershipWhere,
  isMembershipEffective,
} from './membershipPeriods.js'

export const SchoolRoleSchema = z.enum([
  'administrator',
  'registrar',
  'teacher',
  'approver',
])

export type CreateSchoolMembership = {
  userId: string
  schoolId: string
  role: SchoolRole
  startsAt?: Date
  endsAt?: Date | null
}

export type SchoolAssignment = {
  school: School
  role: SchoolRole
}

export type StaffAssignment = {
  user: User
  role: SchoolRole
}

export class DuplicateSchoolMembershipError extends Error {
  constructor() {
    super('User is already assigned to this school')
  }
}

export async function assignUserToSchool(
  database: PrismaClient,
  data: CreateSchoolMembership,
  actorUserId?: string,
): Promise<SchoolMembership> {
  const role = SchoolRoleSchema.parse(data.role)
  if (data.endsAt && data.endsAt <= (data.startsAt ?? new Date()))
    throw new Error('Membership end must follow its start')
  try {
    if (!actorUserId)
      return await database.schoolMembership.create({
        data: { ...data, role },
      })
    return await database.$transaction(async (transaction) => {
      const membership = await transaction.schoolMembership.create({
        data: { ...data, role },
      })
      await recordAuditEvent(transaction, {
        schoolId: data.schoolId,
        actorUserId,
        action: 'schoolStaff.assigned',
        resourceType: 'membership',
        resourceId: data.userId,
        metadata: { role, userId: data.userId },
      })
      return membership
    })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new DuplicateSchoolMembershipError()
    }
    throw error
  }
}

export async function findSchoolMembership(
  database: PrismaClient,
  userId: string,
  schoolId: string,
): Promise<SchoolMembership | null> {
  const membership = await database.schoolMembership.findUnique({
    where: { userId_schoolId: { userId, schoolId } },
  })
  return isMembershipEffective(membership) ? membership : null
}

export async function listSchoolAssignmentsForUser(
  database: PrismaClient,
  userId: string,
): Promise<SchoolAssignment[]> {
  const memberships = await database.schoolMembership.findMany({
    where: { userId, ...effectiveMembershipWhere() },
    include: { school: true },
    orderBy: [{ school: { name: 'asc' } }, { schoolId: 'asc' }],
  })
  return memberships.map(({ school, role }) => ({ school, role }))
}

export async function listStaffAssignmentsForSchool(
  database: PrismaClient,
  schoolId: string,
): Promise<StaffAssignment[]> {
  const memberships = await database.schoolMembership.findMany({
    where: { schoolId, ...effectiveMembershipWhere() },
    include: { user: true },
    orderBy: [{ user: { email: 'asc' } }, { userId: 'asc' }],
  })
  return memberships.map(({ user, role }) => ({ user, role }))
}

export async function hasSchoolRole(
  database: PrismaClient,
  userId: string,
  schoolId: string,
  role: SchoolRole,
): Promise<boolean> {
  const checkedRole = SchoolRoleSchema.parse(role)
  const membership = await findSchoolMembership(database, userId, schoolId)
  return membership?.role === checkedRole
}
