import { describe, expect, it, vi } from 'vitest'
import {
  getNotificationPreferences,
  notificationCategories,
  setNotificationPreference,
} from './notificationPreferences.js'

const userId = '123e4567-e89b-42d3-a456-426614174001'

describe('notification preferences', () => {
  it('defaults to in-app delivery and conservative email settings', async () => {
    const database = {
      notificationPreference: { findMany: vi.fn().mockResolvedValue([]) },
    }
    const preferences = await getNotificationPreferences(
      database as never,
      userId,
    )
    expect(preferences).toHaveLength(notificationCategories.length)
    expect(preferences.every((item) => item.inAppEnabled)).toBe(true)
    expect(preferences.every((item) => !item.emailEnabled)).toBe(true)
  })

  it('does not allow mandatory security in-app notifications to be disabled', async () => {
    const upsert = vi.fn()
    const database = { notificationPreference: { upsert } }
    await expect(
      setNotificationPreference(database as never, userId, 'accountSecurity', {
        inAppEnabled: false,
        emailEnabled: false,
      }),
    ).rejects.toThrow('mandatory')
    expect(upsert).not.toHaveBeenCalled()
    await setNotificationPreference(database as never, userId, 'support', {
      inAppEnabled: true,
      emailEnabled: true,
    })
    expect(upsert).toHaveBeenCalledOnce()
  })
})
