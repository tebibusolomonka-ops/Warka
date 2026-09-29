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
  'reporting',
])

export const notificationCategories = NotificationCategorySchema.options
export const DigestCadenceSchema = z.enum(['off', 'daily', 'weekly'])
export const digestCategories = [
  'academicResults',
  'schoolAnnouncements',
  'learningMaterials',
] as const

export type EffectiveNotificationPreference = {
  category: NotificationCategory
  inAppEnabled: boolean
  emailEnabled: boolean
  digestCadence: z.infer<typeof DigestCadenceSchema>
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
      digestCadence: row?.digestCadence ?? 'off',
    }
  })
}

export async function setNotificationPreference(
  database: Pick<PrismaClient, 'notificationPreference'>,
  userId: string,
  category: NotificationCategory,
  input: {
    inAppEnabled: boolean
    emailEnabled: boolean
    digestCadence?: z.infer<typeof DigestCadenceSchema>
  },
) {
  const parsedUserId = z.uuid().parse(userId)
  const parsedCategory = NotificationCategorySchema.parse(category)
  if (parsedCategory === 'accountSecurity' && !input.inAppEnabled)
    throw new Error('Account security in-app notifications are mandatory')
  const digestCadence = DigestCadenceSchema.parse(input.digestCadence ?? 'off')
  if (
    digestCadence !== 'off' &&
    (!input.emailEnabled ||
      !digestCategories.includes(
        parsedCategory as (typeof digestCategories)[number],
      ))
  )
    throw new Error('Digest cadence is unavailable for this preference')
  return database.notificationPreference.upsert({
    where: {
      userId_category: { userId: parsedUserId, category: parsedCategory },
    },
    create: {
      userId: parsedUserId,
      category: parsedCategory,
      inAppEnabled: input.inAppEnabled,
      emailEnabled: input.emailEnabled,
      digestCadence,
    },
    update: {
      inAppEnabled: input.inAppEnabled,
      emailEnabled: input.emailEnabled,
      digestCadence,
    },
  })
}
