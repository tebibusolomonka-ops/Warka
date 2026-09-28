import type { PrismaClient } from '@prisma/client'
import { createNotifications } from './notifications.js'

type Store = Pick<PrismaClient, 'notification' | 'notificationPreference'>
export async function notifyMeeting(
  database: Store,
  recipients: string[],
  action:
    | 'requested'
    | 'scheduled'
    | 'rescheduled'
    | 'declined'
    | 'cancelled'
    | 'completed',
  requestId: string,
) {
  const unique = [...new Set(recipients)]
  const preferences = await database.notificationPreference.findMany({
    where: { userId: { in: unique }, category: 'familyCommunication' },
    select: { userId: true, inAppEnabled: true, emailEnabled: true },
  })
  const byUser = new Map(
    preferences.map((preference) => [preference.userId, preference]),
  )
  const allowed = unique.filter((userId) => {
    const preference = byUser.get(userId)
    return !preference || preference.inAppEnabled || preference.emailEnabled
  })
  return createNotifications(database, allowed, {
    type: `meeting.${action}`,
    title: `Family meeting ${action}`,
    message: 'Open Warka to view this family meeting update.',
    resourceType: 'parentTeacherMeetingRequest',
    resourceId: requestId,
  })
}
