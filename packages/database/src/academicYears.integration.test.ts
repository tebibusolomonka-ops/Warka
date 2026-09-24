import { afterAll, describe, expect, it } from 'vitest'
import { createDatabaseClient } from './index.js'
import { createOrganization } from './organizations.js'
import { createSchool } from './schools.js'
import {
  createAcademicYear,
  DuplicateAcademicYearError,
  findAcademicYearById,
  listAcademicYearsForSchool,
} from './academicYears.js'

const testUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = testUrl
  ? createDatabaseClient({ DATABASE_URL: testUrl })
  : null

afterAll(async () => {
  await database?.$disconnect()
})

describe.skipIf(!database)('academic years in PostgreSQL', () => {
  it('creates and isolates school years and rejects duplicate names', async () => {
    const organization = await createOrganization(database!, {
      name: 'Academic year test organization',
    })
    const firstSchool = await createSchool(database!, {
      organizationId: organization.id,
      name: 'First school',
    })
    const secondSchool = await createSchool(database!, {
      organizationId: organization.id,
      name: 'Second school',
    })

    try {
      const input = {
        schoolId: firstSchool.id,
        name: 'School supplied year',
        startsOn: '2026-09-11',
        endsOn: '2027-09-10',
      }
      const year = await createAcademicYear(database!, input)
      expect(year.startsOn.toISOString()).toBe('2026-09-11T00:00:00.000Z')
      expect(
        await findAcademicYearById(database!, firstSchool.id, year.id),
      ).toEqual(year)
      expect(
        await findAcademicYearById(database!, secondSchool.id, year.id),
      ).toBeNull()
      expect(
        await listAcademicYearsForSchool(database!, firstSchool.id),
      ).toEqual([year])
      expect(
        await listAcademicYearsForSchool(database!, secondSchool.id),
      ).toEqual([])
      await expect(createAcademicYear(database!, input)).rejects.toBeInstanceOf(
        DuplicateAcademicYearError,
      )
      await expect(
        createAcademicYear(database!, { ...input, schoolId: secondSchool.id }),
      ).resolves.toMatchObject({ name: input.name, schoolId: secondSchool.id })
    } finally {
      await database!.academicYear.deleteMany({
        where: { schoolId: { in: [firstSchool.id, secondSchool.id] } },
      })
      await database!.school.deleteMany({
        where: { organizationId: organization.id },
      })
      await database!.organization.delete({ where: { id: organization.id } })
    }
  })
})
