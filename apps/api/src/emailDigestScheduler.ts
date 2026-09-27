import type { PrismaClient } from '@warka/database'
import { z } from 'zod'

const typesByCategory = {
  academicResults: ['result.published'],
  schoolAnnouncements: ['announcement.published'],
  learningMaterials: ['learningMaterial.published'],
} as const

export function digestWindow(cadence: 'daily' | 'weekly', now = new Date()) {
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  )
  if (cadence === 'weekly')
    end.setUTCDate(end.getUTCDate() - ((end.getUTCDay() + 6) % 7))
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - (cadence === 'daily' ? 1 : 7))
  return { start, end }
}

export async function scheduleDueEmailDigests(
  database: PrismaClient,
  now = new Date(),
) {
  const preferences = await database.notificationPreference.findMany({
    where: {
      emailEnabled: true,
      digestCadence: { in: ['daily', 'weekly'] },
      category: {
        in: ['academicResults', 'schoolAnnouncements', 'learningMaterials'],
      },
      user: { accountStatus: 'active' },
    },
    select: {
      userId: true,
      category: true,
      digestCadence: true,
      updatedAt: true,
      user: { select: { email: true } },
    },
  })
  const groups = new Map<string, typeof preferences>()
  for (const preference of preferences) {
    if (!z.email().safeParse(preference.user.email).success) continue
    const key = `${preference.userId}:${preference.digestCadence}`
    const group = groups.get(key) ?? []
    group.push(preference)
    groups.set(key, group)
  }
  let queued = 0
  for (const group of groups.values()) {
    const first = group[0]!
    if (first.digestCadence === 'off') continue
    const { start, end } = digestWindow(first.digestCadence, now)
    const filters = group.map((preference) => ({
      type: {
        in: [
          ...typesByCategory[
            preference.category as keyof typeof typesByCategory
          ],
        ],
      },
      createdAt: {
        gte: preference.updatedAt > start ? preference.updatedAt : start,
        lt: end,
      },
    }))
    const itemCount = await database.notification.count({
      where: { userId: first.userId, OR: filters },
    })
    if (itemCount === 0) continue
    const created = await database.$transaction(async (transaction) => {
      const digest = await transaction.emailDigest.upsert({
        where: {
          userId_windowStartAt_windowEndAt: {
            userId: first.userId,
            windowStartAt: start,
            windowEndAt: end,
          },
        },
        create: {
          userId: first.userId,
          windowStartAt: start,
          windowEndAt: end,
          itemCount: Math.min(itemCount, 10_000),
        },
        update: {},
        include: { delivery: { select: { id: true } } },
      })
      if (digest.delivery || digest.status !== 'queued') return false
      const delivery = await transaction.emailDelivery.create({
        data: {
          recipientUserId: first.userId,
          recipientAddress: first.user.email,
          digestId: digest.id,
          templateKey: 'notificationDigest',
          scheduledAt: now,
        },
      })
      await transaction.scheduledTaskExecution.create({
        data: {
          taskType: 'emailDelivery',
          scope: 'notification_digest',
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
  return { queued }
}
