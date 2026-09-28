import type { PrismaClient } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import {
  AssessmentSessionStateError,
  completeAssessmentSession,
  createAssessmentSession,
} from './assessmentSessions.js'

const id = '6f366e77-a14d-469d-9ea5-737091a426cf'

describe('assessment session lifecycle', () => {
  it('requires a scheduled assessment before planning a session', async () => {
    const database = {
      assessmentSchedule: { findFirst: async () => null },
    } as unknown as PrismaClient
    await expect(
      createAssessmentSession(database, id, id),
    ).rejects.toBeInstanceOf(AssessmentSessionStateError)
  })

  it('copies date and class context when planning', async () => {
    let data: unknown
    const schedule = {
      schoolClassId: id,
      scheduledDate: new Date('2026-10-10T00:00:00.000Z'),
      startTime: '09:00',
      endTime: '10:00',
    }
    const database = {
      assessmentSchedule: { findFirst: async () => schedule },
      assessmentSession: {
        create: async (input: { data: unknown }) => {
          data = input.data
          return input.data
        },
      },
    } as unknown as PrismaClient
    await createAssessmentSession(database, id, id)
    expect(data).toMatchObject({
      schoolId: id,
      scheduleId: id,
      schoolClassId: id,
      sessionDate: schedule.scheduledDate,
    })
  })

  it('rejects completion of a session that is not open', async () => {
    const database = {
      assessmentSession: { updateMany: async () => ({ count: 0 }) },
    } as unknown as PrismaClient
    await expect(
      completeAssessmentSession(database, id, id),
    ).rejects.toBeInstanceOf(AssessmentSessionStateError)
  })
})
