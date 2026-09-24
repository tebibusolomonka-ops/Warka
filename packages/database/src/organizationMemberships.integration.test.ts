import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { createDatabaseClient } from './index.js'
import { createOrganization } from './organizations.js'
import { createUser } from './users.js'
import {
  createOrganizationMembership,
  DuplicateOrganizationMembershipError,
  findOrganizationMembership,
  hasOrganizationAdminRole,
  listOrganizationsForUser,
} from './organizationMemberships.js'

const testUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = testUrl
  ? createDatabaseClient({ DATABASE_URL: testUrl })
  : null

afterAll(async () => {
  await database?.$disconnect()
})

describe.skipIf(!database)('organization memberships', () => {
  it('supports owner and administrator memberships and prevents duplicates', async () => {
    const user = await createUser(database!, {
      email: `member-${randomUUID()}@example.test`,
      displayName: 'Member',
    })
    const first = await createOrganization(database!, { name: 'First office' })
    const second = await createOrganization(database!, {
      name: 'Second office',
    })

    try {
      const owner = await createOrganizationMembership(database!, {
        userId: user.id,
        organizationId: first.id,
        role: 'owner',
      })
      const administrator = await createOrganizationMembership(database!, {
        userId: user.id,
        organizationId: second.id,
        role: 'administrator',
      })

      expect(
        await findOrganizationMembership(database!, user.id, first.id),
      ).toEqual(owner)
      expect(
        await findOrganizationMembership(database!, user.id, second.id),
      ).toEqual(administrator)
      expect(await hasOrganizationAdminRole(database!, user.id, first.id)).toBe(
        true,
      )
      expect(
        await hasOrganizationAdminRole(database!, user.id, second.id),
      ).toBe(true)
      expect(await listOrganizationsForUser(database!, user.id)).toEqual([
        { organization: first, role: 'owner' },
        { organization: second, role: 'administrator' },
      ])
      await expect(
        createOrganizationMembership(database!, {
          userId: user.id,
          organizationId: first.id,
          role: 'administrator',
        }),
      ).rejects.toBeInstanceOf(DuplicateOrganizationMembershipError)
    } finally {
      await database!.organizationMembership.deleteMany({
        where: { userId: user.id },
      })
      await database!.organization.deleteMany({
        where: { id: { in: [first.id, second.id] } },
      })
      await database!.user.delete({ where: { id: user.id } })
    }
  })

  it('keeps membership checks scoped to the selected organization', async () => {
    const user = await createUser(database!, {
      email: `member-${randomUUID()}@example.test`,
      displayName: 'Member',
    })
    const allowed = await createOrganization(database!, {
      name: 'Allowed office',
    })
    const other = await createOrganization(database!, { name: 'Other office' })

    try {
      await createOrganizationMembership(database!, {
        userId: user.id,
        organizationId: allowed.id,
        role: 'owner',
      })
      expect(
        await findOrganizationMembership(database!, user.id, other.id),
      ).toBeNull()
      expect(await hasOrganizationAdminRole(database!, user.id, other.id)).toBe(
        false,
      )
      expect(
        (await listOrganizationsForUser(database!, user.id)).map(
          ({ organization }) => organization.id,
        ),
      ).toEqual([allowed.id])
    } finally {
      await database!.organizationMembership.deleteMany({
        where: { userId: user.id },
      })
      await database!.organization.deleteMany({
        where: { id: { in: [allowed.id, other.id] } },
      })
      await database!.user.delete({ where: { id: user.id } })
    }
  })
})
