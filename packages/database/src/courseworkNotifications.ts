import type { PrismaClient } from '@prisma/client'
import { createNotifications } from './notifications.js'

type Store = Pick<PrismaClient, 'notification' | 'notificationPreference'>
export async function notifyCoursework(
  database: Store,
  recipients: string[],
  type: string,
  title: string,
  resourceId: string,
) {
  const unique = [...new Set(recipients)]
  if (!unique.length) return { count: 0 }
  const preferences = await database.notificationPreference.findMany({
    where: { userId: { in: unique }, category: 'learningMaterials' },
    select: { userId: true, inAppEnabled: true, emailEnabled: true },
  })
  const byUser = new Map(preferences.map((item) => [item.userId, item]))
  const allowed = unique.filter((id) => {
    const preference = byUser.get(id)
    return !preference || preference.inAppEnabled || preference.emailEnabled
  })
  return createNotifications(database, allowed, {
    type,
    title,
    message: 'Open Warka to view this coursework update.',
    resourceType: 'courseworkAssignment',
    resourceId,
  })
}

export async function studentCourseworkRecipients(
  database: Pick<PrismaClient, 'enrollment' | 'studentAccess'>,
  assignment: {
    schoolId: string
    academicYearId: string
    schoolClassId: string
  },
) {
  const enrollments = await database.enrollment.findMany({
    where: {
      schoolId: assignment.schoolId,
      academicYearId: assignment.academicYearId,
      schoolClassId: assignment.schoolClassId,
      status: 'approved',
      withdrawnAt: null,
    },
    select: { studentId: true },
  })
  const access = await database.studentAccess.findMany({
    where: { studentId: { in: enrollments.map((item) => item.studentId) } },
    select: { userId: true },
  })
  return access.map((item) => item.userId)
}
