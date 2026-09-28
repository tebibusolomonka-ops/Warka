import type { PrismaClient } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'
import { notifyCoursework } from './courseworkNotifications.js'

const first = '00000000-0000-4000-8000-000000000001'
const second = '00000000-0000-4000-8000-000000000002'
describe('coursework notification preferences', () => {
  it('deduplicates recipients and excludes users with both channels disabled', async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 1 })
    const database = {
      notificationPreference: {
        findMany: vi.fn().mockResolvedValue([
          { userId: first, inAppEnabled: false, emailEnabled: false },
          { userId: second, inAppEnabled: false, emailEnabled: true },
        ]),
      },
      notification: { createMany },
    } as unknown as PrismaClient
    await notifyCoursework(
      database,
      [first, second, second],
      'coursework.feedbackReleased',
      'Feedback available',
      first,
    )
    expect(createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          userId: second,
          message: 'Open Warka to view this coursework update.',
        }),
      ],
    })
  })
})
