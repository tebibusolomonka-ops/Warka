import type { PrismaClient } from '@prisma/client'
import { effectiveMembershipWhere } from './membershipPeriods.js'
import { PrivacyPermissionError } from './privacyRequests.js'

type AccessStore = Pick<
  PrismaClient,
  'user' | 'school' | 'organizationMembership' | 'schoolMembership'
>
export async function requirePrivacyReviewer(
  database: AccessStore,
  actorUserId: string,
  schoolId: string,
  now = new Date(),
) {
  const [actor, school] = await Promise.all([
    database.user.findUnique({
      where: { id: actorUserId },
      select: { accountStatus: true },
    }),
    database.school.findUnique({
      where: { id: schoolId },
      select: { organizationId: true },
    }),
  ])
  if (actor?.accountStatus !== 'active' || !school)
    throw new PrivacyPermissionError()
  const [organization, membership] = await Promise.all([
    database.organizationMembership.findUnique({
      where: {
        userId_organizationId: {
          userId: actorUserId,
          organizationId: school.organizationId,
        },
        ...effectiveMembershipWhere(now),
      },
      select: { role: true },
    }),
    database.schoolMembership.findUnique({
      where: {
        userId_schoolId: { userId: actorUserId, schoolId },
        ...effectiveMembershipWhere(now),
      },
      select: { role: true },
    }),
  ])
  if (
    !(organization && ['owner', 'administrator'].includes(organization.role)) &&
    membership?.role !== 'administrator'
  )
    throw new PrivacyPermissionError()
  return { organizationId: school.organizationId }
}
