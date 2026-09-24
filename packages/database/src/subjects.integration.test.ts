import { afterAll, describe, expect, it } from 'vitest'
import { createDatabaseClient } from './index.js'
import { createOrganization } from './organizations.js'
import { createSchool } from './schools.js'
import {
  createSubject,
  DuplicateSubjectError,
  findSubjectById,
  listSubjectsForSchool,
} from './subjects.js'

const testUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = testUrl
  ? createDatabaseClient({ DATABASE_URL: testUrl })
  : null

afterAll(async () => {
  await database?.$disconnect()
})

describe.skipIf(!database)('subjects in PostgreSQL', () => {
  it('creates optional codes and enforces uniqueness and school isolation', async () => {
    const organization = await createOrganization(database!, {
      name: 'Subject test organization',
    })
    const firstSchool = await createSchool(database!, {
      organizationId: organization.id,
      name: 'First subject school',
    })
    const secondSchool = await createSchool(database!, {
      organizationId: organization.id,
      name: 'Second subject school',
    })
    try {
      const first = await createSubject(database!, {
        schoolId: firstSchool.id,
        name: 'Mathematics',
        code: ' math ',
      })
      const uncoded = await createSubject(database!, {
        schoolId: firstSchool.id,
        name: 'Reading',
      })
      expect(first.code).toBe('MATH')
      expect(uncoded.code).toBeNull()
      expect(
        await findSubjectById(database!, firstSchool.id, first.id),
      ).toEqual(first)
      expect(
        await findSubjectById(database!, secondSchool.id, first.id),
      ).toBeNull()
      expect(
        (await listSubjectsForSchool(database!, firstSchool.id)).map(
          ({ id }) => id,
        ),
      ).toEqual([first.id, uncoded.id])
      expect(await listSubjectsForSchool(database!, secondSchool.id)).toEqual(
        [],
      )
      await expect(
        createSubject(database!, {
          schoolId: firstSchool.id,
          name: 'Mathematics',
        }),
      ).rejects.toBeInstanceOf(DuplicateSubjectError)
      await expect(
        createSubject(database!, {
          schoolId: firstSchool.id,
          name: 'Other',
          code: 'MATH',
        }),
      ).rejects.toBeInstanceOf(DuplicateSubjectError)
      await expect(
        createSubject(database!, {
          schoolId: secondSchool.id,
          name: 'Mathematics',
          code: 'math',
        }),
      ).resolves.toMatchObject({ schoolId: secondSchool.id, code: 'MATH' })
    } finally {
      await database!.subject.deleteMany({
        where: { schoolId: { in: [firstSchool.id, secondSchool.id] } },
      })
      await database!.school.deleteMany({
        where: { organizationId: organization.id },
      })
      await database!.organization.delete({ where: { id: organization.id } })
    }
  })
})
