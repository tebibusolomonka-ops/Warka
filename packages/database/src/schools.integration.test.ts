import { afterAll, describe, expect, it } from 'vitest'
import { createDatabaseClient } from './index.js'
import { createOrganization } from './organizations.js'
import {
  createSchool,
  findSchoolById,
  listSchoolsForOrganization,
} from './schools.js'

const testUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = testUrl
  ? createDatabaseClient({ DATABASE_URL: testUrl })
  : null

afterAll(async () => {
  await database?.$disconnect()
})

describe.skipIf(!database)('school repository', () => {
  it('creates, finds, and lists schools within an organization', async () => {
    const organization = await createOrganization(database!, {
      name: 'Test organization',
    })

    try {
      const school = await createSchool(database!, {
        organizationId: organization.id,
        name: 'Test school',
      })

      expect(await findSchoolById(database!, school.id)).toEqual(school)
      expect(
        await findSchoolById(database!, '00000000-0000-0000-0000-000000000000'),
      ).toBeNull()
      expect(
        await listSchoolsForOrganization(database!, organization.id),
      ).toEqual([school])
      expect(
        await listSchoolsForOrganization(
          database!,
          '00000000-0000-0000-0000-000000000000',
        ),
      ).toEqual([])
    } finally {
      await database!.school.deleteMany({
        where: { organizationId: organization.id },
      })
      await database!.organization.delete({ where: { id: organization.id } })
    }
  })
})
