import { afterAll, describe, expect, it } from 'vitest'
import { createDatabaseClient } from './index.js'
import { createOrganization, findOrganizationById } from './organizations.js'

const testUrl = process.env.TEST_DATABASE_URL
const database = testUrl ? createDatabaseClient({ DATABASE_URL: testUrl }) : null

afterAll(async () => {
  await database?.$disconnect()
})

describe.skipIf(!database)('organization repository', () => {
  it('creates and finds an organization', async () => {
    const created = await createOrganization(database!, { name: 'Test institution' })

    try {
      expect(created.id).toBeTruthy()
      expect(created.name).toBe('Test institution')
      expect(await findOrganizationById(database!, created.id)).toEqual(created)
      expect(await findOrganizationById(database!, '00000000-0000-0000-0000-000000000000')).toBeNull()
    } finally {
      await database!.organization.delete({ where: { id: created.id } })
    }
  })
})
