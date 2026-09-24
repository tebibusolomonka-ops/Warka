import { randomUUID } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import {
  createGradingPeriod,
  findGradingPeriodById,
  InvalidGradingPeriodError,
  listGradingPeriods,
} from './gradingPeriods.js'

const schoolId = randomUUID()
const academicYearId = randomUUID()
const input = {
  schoolId,
  academicYearId,
  name: 'School term',
  startsOn: '2026-09-11',
  endsOn: '2027-01-31',
}

function fixture() {
  return {
    academicYear: {
      findFirst: vi.fn().mockResolvedValue({
        startsOn: new Date('2026-09-11T00:00:00.000Z'),
        endsOn: new Date('2027-09-10T00:00:00.000Z'),
      }),
    },
    gradingPeriod: {
      create: vi.fn().mockImplementation(async ({ data }) => data),
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
  } as unknown as PrismaClient
}

describe('grading periods', () => {
  it('converts school dates and scopes lookup and listing', async () => {
    const database = fixture()
    await createGradingPeriod(database, input)
    expect(database.gradingPeriod.create).toHaveBeenCalledWith({
      data: {
        schoolId,
        academicYearId,
        name: 'School term',
        startsOn: new Date('2026-09-11T00:00:00.000Z'),
        endsOn: new Date('2027-01-31T00:00:00.000Z'),
      },
    })
    await findGradingPeriodById(
      database,
      schoolId,
      academicYearId,
      randomUUID(),
    )
    await listGradingPeriods(database, schoolId, academicYearId)
    expect(database.gradingPeriod.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { schoolId, academicYearId } }),
    )
  })

  it('rejects periods outside the year and reversed dates', async () => {
    const database = fixture()
    await expect(
      createGradingPeriod(database, { ...input, endsOn: '2027-09-11' }),
    ).rejects.toBeInstanceOf(InvalidGradingPeriodError)
    await expect(
      createGradingPeriod(database, { ...input, startsOn: '2026-09-10' }),
    ).rejects.toBeInstanceOf(InvalidGradingPeriodError)
    await expect(
      createGradingPeriod(database, { ...input, startsOn: input.endsOn }),
    ).rejects.toThrow()
    expect(database.gradingPeriod.create).not.toHaveBeenCalled()
  })
})
