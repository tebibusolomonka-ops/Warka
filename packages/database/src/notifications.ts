import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'

const PlainText = z
  .string()
  .trim()
  .min(1)
  .refine(
    (value) => !/<[^>]+>/u.test(value),
    'Notification text must be plain text',
  )

export const CreateNotificationSchema = z.strictObject({
  userId: z.uuid(),
  type: z.string().regex(/^[a-z][a-zA-Z0-9.]{1,59}$/),
  title: PlainText.max(120),
  message: PlainText.max(300),
  resourceType: z
    .string()
    .regex(/^[a-z][a-zA-Z0-9]{1,59}$/)
    .optional(),
  resourceId: z.string().min(1).max(120).optional(),
})

export type CreateNotification = z.infer<typeof CreateNotificationSchema>

type NotificationStore = Pick<PrismaClient, 'notification'>

export function createNotification(
  database: NotificationStore,
  input: unknown,
) {
  const data = CreateNotificationSchema.parse(input)
  return database.notification.create({
    data: {
      userId: data.userId,
      type: data.type,
      title: data.title,
      message: data.message,
      ...(data.resourceType ? { resourceType: data.resourceType } : {}),
      ...(data.resourceId ? { resourceId: data.resourceId } : {}),
    },
  })
}

export function createNotifications(
  database: NotificationStore,
  recipients: string[],
  input: Omit<CreateNotification, 'userId'>,
) {
  const unique = [
    ...new Set(recipients.map((userId) => z.uuid().parse(userId))),
  ]
  const data = unique.map((userId) =>
    CreateNotificationSchema.parse({ ...input, userId }),
  )
  if (data.length === 0) return Promise.resolve({ count: 0 })
  return database.notification.createMany({
    data: data.map((item) => ({
      userId: item.userId,
      type: item.type,
      title: item.title,
      message: item.message,
      ...(item.resourceType ? { resourceType: item.resourceType } : {}),
      ...(item.resourceId ? { resourceId: item.resourceId } : {}),
    })),
  })
}

export function listNotifications(
  database: NotificationStore,
  userId: string,
  options: { unread?: boolean; take?: number; cursor?: string } = {},
) {
  z.uuid().parse(userId)
  const take = z
    .number()
    .int()
    .min(1)
    .max(50)
    .parse(options.take ?? 20)
  const cursor = options.cursor ? z.uuid().parse(options.cursor) : undefined
  return database.notification.findMany({
    where: { userId, ...(options.unread ? { readAt: null } : {}) },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })
}

export function unreadNotificationCount(
  database: NotificationStore,
  userId: string,
) {
  z.uuid().parse(userId)
  return database.notification.count({ where: { userId, readAt: null } })
}

export async function markNotificationRead(
  database: NotificationStore,
  userId: string,
  notificationId: string,
) {
  z.uuid().parse(userId)
  z.uuid().parse(notificationId)
  const result = await database.notification.updateMany({
    where: { id: notificationId, userId, readAt: null },
    data: { readAt: new Date() },
  })
  return result.count > 0
}

export function markAllNotificationsRead(
  database: NotificationStore,
  userId: string,
) {
  z.uuid().parse(userId)
  return database.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  })
}
