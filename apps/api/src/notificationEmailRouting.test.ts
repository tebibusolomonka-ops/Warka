import { describe, expect, it, vi } from 'vitest'
import {
  emailCategoryForNotification,
  routePendingNotificationEmails,
} from './notificationEmailRouting.js'

describe('notification email routing', () => {
  it('maps only selected existing events to email categories', () => {
    expect(emailCategoryForNotification('result.published')).toBe(
      'academicResults',
    )
    expect(emailCategoryForNotification('coursework.feedbackReleased')).toBe(
      'learningMaterials',
    )
    expect(emailCategoryForNotification('familyMessage.reply')).toBe(
      'familyCommunication',
    )
    expect(emailCategoryForNotification('meeting.scheduled')).toBe(
      'familyCommunication',
    )
    expect(emailCategoryForNotification('privacy.fulfilled')).toBe('privacy')
    expect(emailCategoryForNotification('operations.backupFailed')).toBeNull()
    expect(emailCategoryForNotification('familyMessage.body')).toBeNull()
  })

  it('queues one brief email only when preference and address permit it', async () => {
    const now = new Date('2026-09-27T12:00:00Z')
    const taskCreate = vi.fn().mockResolvedValue({})
    const deliveryCreate = vi.fn().mockResolvedValue({ id: 'delivery-id' })
    const preference = vi
      .fn()
      .mockResolvedValueOnce({ emailEnabled: true, digestCadence: 'off' })
      .mockResolvedValueOnce({ emailEnabled: true, digestCadence: 'daily' })
    const transaction = {
      notification: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 'notification-id',
          type: 'result.published',
          userId: 'user-id',
          createdAt: now,
          user: {
            email: 'recipient@example.test',
            accountStatus: 'active',
          },
        }),
      },
      notificationPreference: { findUnique: preference },
      emailDelivery: { create: deliveryCreate },
      scheduledTaskExecution: { create: taskCreate },
    }
    const database = {
      notification: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: 'first-id' }, { id: 'second-id' }]),
      },
      $transaction: (work: (value: unknown) => Promise<unknown>) =>
        work(transaction),
    }
    expect(
      await routePendingNotificationEmails(database as never, now),
    ).toEqual({ processed: 2, queued: 1 })
    expect(deliveryCreate).toHaveBeenCalledOnce()
    expect(deliveryCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        notificationId: 'notification-id',
        templateKey: 'notificationUpdate',
      }),
    })
    expect(taskCreate).toHaveBeenCalledOnce()
    expect(transaction.notification.updateMany).toHaveBeenCalledTimes(2)
  })

  it('does not queue mail for an unusable recipient address', async () => {
    const create = vi.fn()
    const findPreference = vi.fn()
    const database = {
      notification: { findMany: vi.fn().mockResolvedValue([{ id: 'item' }]) },
      $transaction: (work: (value: unknown) => Promise<unknown>) =>
        work({
          notification: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            findUniqueOrThrow: vi.fn().mockResolvedValue({
              id: 'item',
              type: 'announcement.published',
              userId: 'user-id',
              createdAt: new Date(),
              user: { email: 'not-an-address', accountStatus: 'active' },
            }),
          },
          notificationPreference: { findUnique: findPreference },
          emailDelivery: { create },
        }),
    }
    expect(
      (await routePendingNotificationEmails(database as never)).queued,
    ).toBe(0)
    expect(findPreference).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
  })
})
