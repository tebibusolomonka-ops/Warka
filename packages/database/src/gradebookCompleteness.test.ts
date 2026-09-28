import { Prisma, type PrismaClient } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import { getGradebookCompleteness } from './gradebookCompleteness.js'

const id = '6f366e77-a14d-469d-9ea5-737091a426cf'
const roster = [
  {
    id: 'e1',
    studentId: 's1',
    student: { studentReference: 'S1', givenName: 'One', familyName: null },
  },
  {
    id: 'e2',
    studentId: 's2',
    student: { studentReference: 'S2', givenName: 'Two', familyName: null },
  },
]

function fixture(options: {
  enrollments?: typeof roster
  marks?: { id: string; enrollmentId: string; score: Prisma.Decimal }[]
  participations?: {
    id: string
    enrollmentId: string
    status: 'absent' | 'present'
    makeUpAssessments: { id: string; status: 'requested' | 'completed' }[]
  }[]
}) {
  return {
    assessment: {
      findFirst: async () => ({
        academicYearId: id,
        schoolClassId: id,
        maximumScore: new Prisma.Decimal(20),
      }),
    },
    enrollment: { findMany: async () => options.enrollments ?? roster },
    mark: { findMany: async () => options.marks ?? [] },
    assessmentParticipation: {
      findMany: async () => options.participations ?? [],
    },
  } as unknown as PrismaClient
}

const mark = (enrollmentId: string, score: number) => ({
  id: `m-${enrollmentId}`,
  enrollmentId,
  score: new Prisma.Decimal(score),
})

describe('factual gradebook completeness', () => {
  it('recognizes complete marks, including a recorded zero', async () => {
    const result = await getGradebookCompleteness(
      fixture({ marks: [mark('e1', 0), mark('e2', 20)] }),
      id,
      id,
    )
    expect(result.complete).toBe(true)
    expect(result.counts).toMatchObject({
      eligible: 2,
      marksEntered: 2,
      marksMissing: 0,
    })
    expect(result.rows[0]?.mark?.score).toBe('0.00')
  })

  it('keeps a missing mark distinct from zero and absence', async () => {
    const result = await getGradebookCompleteness(
      fixture({
        marks: [mark('e1', 0)],
        participations: [
          {
            id: 'p',
            enrollmentId: 'e2',
            status: 'absent',
            makeUpAssessments: [],
          },
        ],
      }),
      id,
      id,
    )
    expect(result.complete).toBe(false)
    expect(result.rows[1]).toMatchObject({
      mark: null,
      participation: 'absent',
      issues: ['MISSING_MARK', 'ABSENT'],
    })
    expect(result.counts).toMatchObject({ marksMissing: 1, absent: 1 })
  })

  it('blocks pending make-up and invalid marks', async () => {
    const result = await getGradebookCompleteness(
      fixture({
        marks: [mark('e1', 21), mark('e2', 10)],
        participations: [
          {
            id: 'p',
            enrollmentId: 'e2',
            status: 'absent',
            makeUpAssessments: [{ id: 'makeup', status: 'requested' }],
          },
        ],
      }),
      id,
      id,
    )
    expect(result.complete).toBe(false)
    expect(result.counts).toMatchObject({ invalidMarks: 1, pendingMakeUp: 1 })
  })

  it('counts only approved class enrollments returned by the scoped roster', async () => {
    const result = await getGradebookCompleteness(
      fixture({ enrollments: [roster[0]!], marks: [mark('e1', 10)] }),
      id,
      id,
    )
    expect(result.counts.eligible).toBe(1)
    expect(result.rows).toHaveLength(1)
  })
})
