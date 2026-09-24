import {
  Prisma,
  type PrismaClient,
  type School,
  type SchoolMembership,
  type SchoolRole,
  type User,
} from '@prisma/client'
import { z } from 'zod'

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
): Promise<SchoolMembership> {
  const role = SchoolRoleSchema.parse(data.role)
  try {
    return await database.schoolMembership.create({
      data: { ...data, role },
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

export function findSchoolMembership(
  database: PrismaClient,
  userId: string,
  schoolId: string,
): Promise<SchoolMembership | null> {
  return database.schoolMembership.findUnique({
    where: { userId_schoolId: { userId, schoolId } },
  })
}

export async function listSchoolAssignmentsForUser(
  database: PrismaClient,
  userId: string,
): Promise<SchoolAssignment[]> {
  const memberships = await database.schoolMembership.findMany({
    where: { userId },
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
    where: { schoolId },
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
