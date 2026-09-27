import { NotificationCategorySchema, type PrismaClient } from '@warka/database'
import { z } from 'zod'

export function emailCategoryForNotification(
  type: string,
): z.infer<typeof NotificationCategorySchema> | null {
  if (type === 'result.published') return 'academicResults'
  if (type === 'announcement.published') return 'schoolAnnouncements'
  if (type === 'familyMessage.reply') return 'familyCommunication'
  if (['support.response', 'support.resolved', 'support.closed'].includes(type))
    return 'support'
  if (type.startsWith('privacy.')) return 'privacy'
  return null
}

export async function routePendingNotificationEmails(
  database: PrismaClient,
  now = new Date(),
) {
  const pending = await database.notification.findMany({
    where: { emailRoutedAt: null },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: 50,
    select: { id: true },
  })
  let queued = 0
  for (const item of pending) {
    const created = await database.$transaction(async (transaction) => {
      const claimed = await transaction.notification.updateMany({
        where: { id: item.id, emailRoutedAt: null },
        data: { emailRoutedAt: now },
      })
      if (claimed.count !== 1) return false
      const notification = await transaction.notification.findUniqueOrThrow({
        where: { id: item.id },
        select: {
          id: true,
          type: true,
          userId: true,
          createdAt: true,
          user: { select: { email: true, accountStatus: true } },
        },
      })
      const category = emailCategoryForNotification(notification.type)
      if (
        !category ||
        notification.createdAt <
          new Date(now.getTime() - 7 * 24 * 60 * 60_000) ||
        notification.user.accountStatus !== 'active' ||
        !z.email().safeParse(notification.user.email).success
      )
        return false
      const preference = await transaction.notificationPreference.findUnique({
        where: {
          userId_category: {
            userId: notification.userId,
            category,
          },
        },
        select: { emailEnabled: true, digestCadence: true },
      })
      if (!preference?.emailEnabled || preference.digestCadence !== 'off')
        return false
      const delivery = await transaction.emailDelivery.create({
        data: {
          recipientUserId: notification.userId,
          recipientAddress: notification.user.email,
          notificationId: notification.id,
          templateKey: 'notificationUpdate',
          scheduledAt: now,
        },
      })
      await transaction.scheduledTaskExecution.create({
        data: {
          taskType: 'emailDelivery',
          scope: 'transactional_email',
          resourceId: delivery.id,
          scheduledFor: now,
          status: 'pending',
          attempt: 1,
        },
      })
      return true
    })
    if (created) queued += 1
  }
  return { processed: pending.length, queued }
}
