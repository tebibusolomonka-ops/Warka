import type { PrismaClient } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'
import {
  planReportingDeadlineNotifications,
  scheduleReportingDeadlineNotifications,
} from './reportingDeadlineNotifications.js'

const now = new Date('2026-09-29T12:00:00Z')
const periodId = '797758fd-9c85-4fb0-890a-2b20577a29d3'
const schoolId = 'e22ba22d-e11d-42d2-b9ae-dde77c24b957'
const userId = '15a0e59a-06b1-4a37-a953-19e42858bb1d'

function period(dueAt: Date, status?: string) {
  return {
    id: periodId,
    opensAt: new Date('2026-09-28T12:00:00Z'),
    dueAt,
    submissionDueOn: dueAt,
    updatedAt: now,
    requirements: [{ schoolId }],
    submissions: status ? [{ schoolId, status }] : [],
  }
}

describe('reporting deadline notifications', () => {
  it('uses neutral copy and stable dedupe keys', () => {
    const recipients = [{ schoolId, userId }]
    const approaching = planReportingDeadlineNotifications(
      [period(new Date('2026-10-01T12:00:00Z'))],
      recipients,
      now,
    )
    expect(approaching).toMatchObject([
      {
        type: 'report.dueSoon',
        dedupeKey: `report:dueSoon:${periodId}:${schoolId}:${userId}`,
      },
    ])
    expect(approaching[0]?.message).not.toMatch(/fraud|failure|delinquent/i)
    expect(
      planReportingDeadlineNotifications(
        [period(new Date('2026-10-01T12:00:00Z'), 'submitted')],
        recipients,
        now,
      ),
    ).toEqual([])
    const overdue = planReportingDeadlineNotifications(
      [period(new Date('2026-09-29T11:00:00Z'))],
      recipients,
      now,
    )
    expect(overdue[0]?.type).toBe('report.due')
  })

  it('writes reminders with database deduplication', async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 1 })
    const database = {
      reportingPeriod: {
        findMany: vi
          .fn()
          .mockResolvedValue([period(new Date('2026-10-01T12:00:00Z'))]),
      },
      schoolMembership: {
        findMany: vi.fn().mockResolvedValue([{ schoolId, userId }]),
      },
      notification: { createMany },
    } as unknown as PrismaClient
    await scheduleReportingDeadlineNotifications(database, now)
    expect(createMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true }),
    )
  })
})
