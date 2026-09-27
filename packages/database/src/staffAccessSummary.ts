import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { hasOrganizationAdminRole } from './organizationMemberships.js'
import { findSchoolMembership } from './schoolMemberships.js'

export class StaffAccessPermissionError extends Error {
  constructor() {
    super('Staff access summary permission denied')
  }
}

export function accessPeriodStatus(
  period: { startsAt: Date; endsAt: Date | null },
  now = new Date(),
) {
  if (period.startsAt > now) return 'future' as const
  if (period.endsAt && period.endsAt <= now) return 'expired' as const
  return 'active' as const
}

export async function listStaffAccess(
  database: PrismaClient,
  actorUserId: string,
  schoolId: string,
  pagination: { take?: number | undefined; skip?: number | undefined } = {},
  now = new Date(),
) {
  z.uuid().parse(actorUserId)
  z.uuid().parse(schoolId)
  const take = z
    .number()
    .int()
    .min(1)
    .max(50)
    .parse(pagination.take ?? 25)
  const skip = z
    .number()
    .int()
    .min(0)
    .max(100000)
    .parse(pagination.skip ?? 0)
  const school = await database.school.findUnique({
    where: { id: schoolId },
    select: { organizationId: true },
  })
  const actor = await database.user.findUnique({
    where: { id: actorUserId },
    select: { accountStatus: true },
  })
  if (!school || actor?.accountStatus !== 'active')
    throw new StaffAccessPermissionError()
  const [organizationAdmin, schoolMembership] = await Promise.all([
    hasOrganizationAdminRole(database, actorUserId, school.organizationId),
    findSchoolMembership(database, actorUserId, schoolId),
  ])
  if (!organizationAdmin && schoolMembership?.role !== 'administrator')
    throw new StaffAccessPermissionError()

  const where = {
    OR: [
      { schoolMemberships: { some: { schoolId } } },
      {
        organizationMemberships: {
          some: { organizationId: school.organizationId },
        },
      },
    ],
  }
  const [total, users] = await Promise.all([
    database.user.count({ where }),
    database.user.findMany({
      where,
      orderBy: [{ email: 'asc' }, { id: 'asc' }],
      take,
      skip,
      select: {
        id: true,
        email: true,
        displayName: true,
        accountStatus: true,
        organizationMemberships: {
          where: { organizationId: school.organizationId },
          select: { role: true, startsAt: true, endsAt: true },
        },
        schoolMemberships: {
          where: { schoolId },
          select: { role: true, startsAt: true, endsAt: true },
        },
        teachingAssignments: {
          where: { schoolId },
          select: {
            id: true,
            academicYearId: true,
            schoolClassId: true,
            subjectId: true,
            startsAt: true,
            endsAt: true,
          },
          orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
        },
      },
    }),
  ])
  return {
    total,
    take,
    skip,
    items: users.map((user) => ({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      accountStatus: user.accountStatus,
      organizationMembership: user.organizationMemberships[0]
        ? {
            ...user.organizationMemberships[0],
            periodStatus: accessPeriodStatus(
              user.organizationMemberships[0],
              now,
            ),
          }
        : null,
      schoolMembership: user.schoolMemberships[0]
        ? {
            ...user.schoolMemberships[0],
            periodStatus: accessPeriodStatus(user.schoolMemberships[0], now),
          }
        : null,
      teachingAssignments: user.teachingAssignments.map((assignment) => ({
        ...assignment,
        periodStatus: accessPeriodStatus(assignment, now),
      })),
    })),
  }
}
