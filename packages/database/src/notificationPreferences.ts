import type { NotificationCategory, PrismaClient } from '@prisma/client'
import { z } from 'zod'

export const NotificationCategorySchema = z.enum([
  'accountSecurity',
  'academicResults',
  'schoolAnnouncements',
  'learningMaterials',
  'documents',
  'familyCommunication',
  'support',
  'privacy',
])

export const notificationCategories = NotificationCategorySchema.options

export type EffectiveNotificationPreference = {
  category: NotificationCategory
  inAppEnabled: boolean
  emailEnabled: boolean
}

export async function getNotificationPreferences(
  database: Pick<PrismaClient, 'notificationPreference'>,
  userId: string,
): Promise<EffectiveNotificationPreference[]> {
  const rows = await database.notificationPreference.findMany({
    where: { userId: z.uuid().parse(userId) },
  })
  const stored = new Map(rows.map((row) => [row.category, row]))
  return notificationCategories.map((category) => {
    const row = stored.get(category)
    return {
      category,
      inAppEnabled:
        category === 'accountSecurity' ? true : (row?.inAppEnabled ?? true),
      emailEnabled: row?.emailEnabled ?? false,
    }
  })
}

export async function setNotificationPreference(
  database: Pick<PrismaClient, 'notificationPreference'>,
  userId: string,
  category: NotificationCategory,
  input: { inAppEnabled: boolean; emailEnabled: boolean },
) {
  const parsedUserId = z.uuid().parse(userId)
  const parsedCategory = NotificationCategorySchema.parse(category)
  if (parsedCategory === 'accountSecurity' && !input.inAppEnabled)
    throw new Error('Account security in-app notifications are mandatory')
  return database.notificationPreference.upsert({
    where: {
      userId_category: { userId: parsedUserId, category: parsedCategory },
    },
    create: { userId: parsedUserId, category: parsedCategory, ...input },
    update: input,
  })
}
