import type { PrismaClient } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import {
  MakeUpAssessmentStateError,
  MakeUpScheduleSchema,
  requestMakeUpAssessment,
  reviewMakeUpAssessment,
} from './makeUpAssessments.js'

const id = '6f366e77-a14d-469d-9ea5-737091a426cf'

describe('make-up assessments', () => {
  it('requires explicit missed participation and reason', async () => {
    const database = {
      assessmentParticipation: { findFirst: async () => null },
    } as unknown as PrismaClient
    await expect(
      requestMakeUpAssessment(database, id, {
        schoolId: id,
        originalParticipationId: id,
        reason: 'Documented absence',
      }),
    ).rejects.toBeInstanceOf(MakeUpAssessmentStateError)
    await expect(
      requestMakeUpAssessment(database, id, {
        schoolId: id,
        originalParticipationId: id,
        reason: '',
      }),
    ).rejects.toThrow()
  })

  it('does not change original participation or create a zero mark', async () => {
    let data: Record<string, unknown> | undefined
    const database = {
      assessmentParticipation: {
        findFirst: async () => ({ sessionId: id, studentId: id }),
      },
      makeUpAssessment: {
        create: async (input: { data: Record<string, unknown> }) => {
          data = input.data
          return input.data
        },
      },
    } as unknown as PrismaClient
    await requestMakeUpAssessment(database, id, {
      schoolId: id,
      originalParticipationId: id,
      reason: 'Documented absence',
    })
    expect(data).toMatchObject({ originalParticipationId: id, studentId: id })
    expect(data).not.toHaveProperty('score')
  })

  it('rejects invalid review transition and backward times', async () => {
    const database = {
      makeUpAssessment: { updateMany: async () => ({ count: 0 }) },
    } as unknown as PrismaClient
    await expect(
      reviewMakeUpAssessment(database, id, id, id, 'approved'),
    ).rejects.toBeInstanceOf(MakeUpAssessmentStateError)
    expect(() =>
      MakeUpScheduleSchema.parse({
        scheduledDate: '2026-10-11',
        startTime: '11:00',
        endTime: '10:00',
      }),
    ).toThrow()
  })
})
