import { afterAll, describe, expect, it } from 'vitest'
import { createDatabaseClient } from './index.js'
import { createOrganization } from './organizations.js'
import { createSchool } from './schools.js'
import { createAcademicYear } from './academicYears.js'
import {
  createGradingPeriod,
  DuplicateGradingPeriodError,
  findGradingPeriodById,
  InvalidGradingPeriodError,
  listGradingPeriods,
} from './gradingPeriods.js'

const testUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = testUrl
  ? createDatabaseClient({ DATABASE_URL: testUrl })
  : null

afterAll(async () => {
  await database?.$disconnect()
})

describe.skipIf(!database)('grading periods in PostgreSQL', () => {
  it('enforces academic year dates and same-school period uniqueness', async () => {
    const organization = await createOrganization(database!, {
      name: 'Grading period test',
    })
    const firstSchool = await createSchool(database!, {
      organizationId: organization.id,
      name: 'First grading school',
    })
    const otherSchool = await createSchool(database!, {
      organizationId: organization.id,
      name: 'Other grading school',
    })
    const schoolIds = [firstSchool.id, otherSchool.id]
    try {
      const year = await createAcademicYear(database!, {
        schoolId: firstSchool.id,
        name: 'Grading year',
        startsOn: '2026-09-11',
        endsOn: '2027-09-10',
      })
      const otherYear = await createAcademicYear(database!, {
        schoolId: otherSchool.id,
        name: 'Grading year',
        startsOn: '2026-09-11',
        endsOn: '2027-09-10',
      })
      const input = {
        schoolId: firstSchool.id,
        academicYearId: year.id,
        name: 'First term',
        startsOn: '2026-09-11',
        endsOn: '2027-01-31',
      }
      const period = await createGradingPeriod(database!, input)
      expect(period.startsOn.toISOString()).toBe('2026-09-11T00:00:00.000Z')
      expect(
        await findGradingPeriodById(
          database!,
          firstSchool.id,
          year.id,
          period.id,
        ),
      ).toEqual(period)
      expect(
        await findGradingPeriodById(
          database!,
          otherSchool.id,
          otherYear.id,
          period.id,
        ),
      ).toBeNull()
      expect(
        await listGradingPeriods(database!, firstSchool.id, year.id),
      ).toEqual([period])
      await expect(
        createGradingPeriod(database!, input),
      ).rejects.toBeInstanceOf(DuplicateGradingPeriodError)
      await expect(
        createGradingPeriod(database!, { ...input, schoolId: otherSchool.id }),
      ).rejects.toBeInstanceOf(InvalidGradingPeriodError)
      await expect(
        createGradingPeriod(database!, {
          ...input,
          endsOn: '2027-09-11',
          name: 'Too late',
        }),
      ).rejects.toBeInstanceOf(InvalidGradingPeriodError)
      await expect(
        createGradingPeriod(database!, {
          ...input,
          startsOn: '2026-09-10',
          name: 'Too early',
        }),
      ).rejects.toBeInstanceOf(InvalidGradingPeriodError)
      await expect(
        createGradingPeriod(database!, {
          ...input,
          schoolId: otherSchool.id,
          academicYearId: otherYear.id,
        }),
      ).resolves.toMatchObject({ schoolId: otherSchool.id, name: 'First term' })
    } finally {
      await database!.gradingPeriod.deleteMany({
        where: { schoolId: { in: schoolIds } },
      })
      await database!.academicYear.deleteMany({
        where: { schoolId: { in: schoolIds } },
      })
      await database!.school.deleteMany({
        where: { organizationId: organization.id },
      })
      await database!.organization.delete({ where: { id: organization.id } })
    }
  })
})
