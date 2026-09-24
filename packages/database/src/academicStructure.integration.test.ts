import { afterAll, describe, expect, it } from 'vitest'
import { createDatabaseClient } from './index.js'
import { createOrganization } from './organizations.js'
import { createSchool } from './schools.js'
import { createAcademicYear } from './academicYears.js'
import {
  createGradeLevel,
  DuplicateGradeLevelError,
  listGradeLevelsForSchool,
} from './gradeLevels.js'
import {
  createSchoolClass,
  DuplicateSchoolClassError,
  findSchoolClassById,
  InvalidClassStructureError,
  listClassesForAcademicYear,
} from './schoolClasses.js'

const testUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = testUrl
  ? createDatabaseClient({ DATABASE_URL: testUrl })
  : null

afterAll(async () => {
  await database?.$disconnect()
})

describe.skipIf(!database)('grade and class structure in PostgreSQL', () => {
  it('enforces school boundaries and scoped uniqueness', async () => {
    const organization = await createOrganization(database!, {
      name: 'Class structure test organization',
    })
    const firstSchool = await createSchool(database!, {
      organizationId: organization.id,
      name: 'First school',
    })
    const secondSchool = await createSchool(database!, {
      organizationId: organization.id,
      name: 'Second school',
    })
    const schoolIds = [firstSchool.id, secondSchool.id]

    try {
      const firstYear = await createAcademicYear(database!, {
        schoolId: firstSchool.id,
        name: 'First year',
        startsOn: '2026-09-11',
        endsOn: '2027-09-10',
      })
      const secondYear = await createAcademicYear(database!, {
        schoolId: secondSchool.id,
        name: 'Second year',
        startsOn: '2026-09-11',
        endsOn: '2027-09-10',
      })
      const firstGrade = await createGradeLevel(database!, {
        schoolId: firstSchool.id,
        name: 'Grade 1',
      })
      const secondGrade = await createGradeLevel(database!, {
        schoolId: secondSchool.id,
        name: 'Grade 1',
      })
      await expect(
        createGradeLevel(database!, {
          schoolId: firstSchool.id,
          name: ' Grade 1 ',
        }),
      ).rejects.toBeInstanceOf(DuplicateGradeLevelError)
      expect(await listGradeLevelsForSchool(database!, firstSchool.id)).toEqual(
        [firstGrade],
      )
      expect(
        await listGradeLevelsForSchool(database!, secondSchool.id),
      ).toEqual([secondGrade])

      const input = {
        schoolId: firstSchool.id,
        academicYearId: firstYear.id,
        gradeLevelId: firstGrade.id,
        name: 'Section A',
      }
      const schoolClass = await createSchoolClass(database!, input)
      expect(
        await findSchoolClassById(database!, firstSchool.id, schoolClass.id),
      ).toEqual(schoolClass)
      expect(
        await findSchoolClassById(database!, secondSchool.id, schoolClass.id),
      ).toBeNull()
      expect(
        await listClassesForAcademicYear(
          database!,
          firstSchool.id,
          firstYear.id,
        ),
      ).toEqual([schoolClass])
      expect(
        await listClassesForAcademicYear(
          database!,
          secondSchool.id,
          firstYear.id,
        ),
      ).toEqual([])
      await expect(createSchoolClass(database!, input)).rejects.toBeInstanceOf(
        DuplicateSchoolClassError,
      )
      await expect(
        createSchoolClass(database!, {
          ...input,
          academicYearId: secondYear.id,
        }),
      ).rejects.toBeInstanceOf(InvalidClassStructureError)
      await expect(
        createSchoolClass(database!, {
          ...input,
          gradeLevelId: secondGrade.id,
        }),
      ).rejects.toBeInstanceOf(InvalidClassStructureError)
      await expect(
        database!.schoolClass.create({
          data: {
            ...input,
            academicYearId: secondYear.id,
            name: 'Crafted class',
          },
        }),
      ).rejects.toThrow()
    } finally {
      await database!.schoolClass.deleteMany({
        where: { schoolId: { in: schoolIds } },
      })
      await database!.gradeLevel.deleteMany({
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
