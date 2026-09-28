import { Prisma, type PrismaClient } from '@prisma/client'
import { z } from 'zod'

const time = z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/)
export const TimetablePeriodInputSchema = z
  .strictObject({
    schoolId: z.uuid(),
    name: z.string().trim().min(1).max(80),
    startTime: time,
    endTime: time,
    sortOrder: z.number().int().min(0).max(100),
    instructional: z.boolean(),
  })
  .refine((value) => value.startTime < value.endTime, {
    path: ['endTime'],
    message: 'Period must end after it starts',
  })

export class TimetablePeriodConflictError extends Error {}

export async function createTimetablePeriod(
  database: PrismaClient,
  input: z.input<typeof TimetablePeriodInputSchema>,
) {
  const value = TimetablePeriodInputSchema.parse(input)
  try {
    return await database.$transaction(
      async (transaction) => {
        const overlapping = await transaction.timetablePeriod.findFirst({
          where: {
            schoolId: value.schoolId,
            startTime: { lt: value.endTime },
            endTime: { gt: value.startTime },
          },
          select: { id: true },
        })
        if (overlapping)
          throw new TimetablePeriodConflictError('Period overlaps another')
        return transaction.timetablePeriod.create({ data: value })
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    )
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ['P2002', 'P2034'].includes(error.code)
    )
      throw new TimetablePeriodConflictError('Period conflicts with another')
    throw error
  }
}

export async function listTimetablePeriods(
  database: PrismaClient,
  schoolId: string,
) {
  return database.timetablePeriod.findMany({
    where: { schoolId },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  })
}
