import type { PrismaClient } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import {
  AssessmentParticipationContextError,
  AssessmentParticipationInputSchema,
  recordAssessmentParticipation,
} from './assessmentParticipation.js'

const id = '6f366e77-a14d-469d-9ea5-737091a426cf'
const input = {
  schoolId: id,
  sessionId: id,
  studentId: id,
  status: 'absent' as const,
}

describe('assessment participation', () => {
  it('does not infer absence from a missing record', () => {
    expect(AssessmentParticipationInputSchema.parse(input).status).toBe(
      'absent',
    )
    expect(() =>
      AssessmentParticipationInputSchema.parse({ ...input, status: '0' }),
    ).toThrow()
  })

  it('requires an open session and eligible enrollment', async () => {
    const noSession = {
      assessmentSession: { findFirst: async () => null },
    } as unknown as PrismaClient
    await expect(
      recordAssessmentParticipation(noSession, id, input),
    ).rejects.toBeInstanceOf(AssessmentParticipationContextError)
    const noEnrollment = {
      assessmentSession: {
        findFirst: async () => ({
          schoolClassId: id,
          schedule: { academicYearId: id },
        }),
      },
      enrollment: { findFirst: async () => null },
    } as unknown as PrismaClient
    await expect(
      recordAssessmentParticipation(noEnrollment, id, input),
    ).rejects.toBeInstanceOf(AssessmentParticipationContextError)
  })

  it('persists a status separately from any mark', async () => {
    let data: Record<string, unknown> | undefined
    const database = {
      assessmentSession: {
        findFirst: async () => ({
          schoolClassId: id,
          schedule: { academicYearId: id },
        }),
      },
      enrollment: { findFirst: async () => ({ id }) },
      assessmentParticipation: {
        create: async (input: { data: Record<string, unknown> }) => {
          data = input.data
          return input.data
        },
      },
    } as unknown as PrismaClient
    await recordAssessmentParticipation(database, id, input)
    expect(data).toMatchObject({
      status: 'absent',
      enrollmentId: id,
      schoolClassId: id,
    })
    expect(data).not.toHaveProperty('score')
  })
})
