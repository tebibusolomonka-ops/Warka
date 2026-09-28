import type { PrismaClient } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'
import { notifyMeeting } from './meetingNotifications.js'

const teacherId = '11111111-1111-4111-8111-111111111111'
const guardianId = '22222222-2222-4222-8222-222222222222'
const requestId = '33333333-3333-4333-8333-333333333333'

describe('family meeting notices', () => {
  it('deduplicates recipients and uses neutral text with communication preferences', async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 1 })
    const database = {
      notificationPreference: {
        findMany: vi.fn().mockResolvedValue([
          { userId: teacherId, inAppEnabled: false, emailEnabled: false },
          { userId: guardianId, inAppEnabled: false, emailEnabled: true },
        ]),
      },
      notification: { createMany },
    } as unknown as PrismaClient
    await notifyMeeting(
      database,
      [teacherId, guardianId, guardianId],
      'scheduled',
      requestId,
    )
    expect(createMany).toHaveBeenCalledWith({
      data: [
        {
          userId: guardianId,
          type: 'meeting.scheduled',
          title: 'Family meeting scheduled',
          message: 'Open Warka to view this family meeting update.',
          resourceType: 'parentTeacherMeetingRequest',
          resourceId: requestId,
        },
      ],
    })
    expect(JSON.stringify(createMany.mock.calls)).not.toContain('phone')
  })
})
