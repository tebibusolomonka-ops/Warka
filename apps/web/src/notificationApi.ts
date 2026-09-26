import { z } from 'zod'
import { requestJson } from './api'

const NotificationSchema = z.object({
  id: z.uuid(),
  type: z.string(),
  title: z.string(),
  message: z.string(),
  resourceType: z.string().nullable(),
  resourceId: z.string().nullable(),
  createdAt: z.iso.datetime(),
  readAt: z.iso.datetime().nullable(),
})
export type NotificationItem = z.infer<typeof NotificationSchema>
const NotificationPageSchema = z.object({
  items: z.array(NotificationSchema),
  nextCursor: z.uuid().nullable(),
})

export async function getNotificationPage(
  baseUrl: string,
  options: { unread?: boolean; cursor?: string } = {},
) {
  const query = new URLSearchParams({ take: '20' })
  if (options.unread) query.set('unread', 'true')
  if (options.cursor) query.set('cursor', options.cursor)
  return NotificationPageSchema.parse(
    await requestJson(baseUrl, `/notifications?${query}`),
  )
}
export async function getUnreadNotificationCount(baseUrl: string) {
  return z
    .object({ count: z.number().int().nonnegative() })
    .parse(await requestJson(baseUrl, '/notifications/unread-count')).count
}
export async function readNotification(baseUrl: string, id: string) {
  await requestJson(baseUrl, `/notifications/${encodeURIComponent(id)}/read`, {
    method: 'POST',
  })
}
export async function readAllNotifications(baseUrl: string) {
  await requestJson(baseUrl, '/notifications/read-all', { method: 'POST' })
}
