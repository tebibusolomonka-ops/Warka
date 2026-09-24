import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { createDatabaseClient } from './index.js'
import { createOrganization } from './organizations.js'
import { createSchool } from './schools.js'
import { createUser } from './users.js'
import {
  assignUserToSchool,
  DuplicateSchoolMembershipError,
  findSchoolMembership,
  hasSchoolRole,
  listSchoolAssignmentsForUser,
  listStaffAssignmentsForSchool,
} from './schoolMemberships.js'

const testUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = testUrl
  ? createDatabaseClient({ DATABASE_URL: testUrl })
  : null

afterAll(async () => {
  await database?.$disconnect()
})

describe.skipIf(!database)('school memberships', () => {
  it('supports each role across schools and prevents duplicate assignments', async () => {
    const user = await createUser(database!, {
      email: `staff-${randomUUID()}@example.test`,
      displayName: 'Staff member',
    })
    const organization = await createOrganization(database!, {
      name: 'Staff office',
    })
    const roles = ['administrator', 'registrar', 'teacher', 'approver'] as const
    const schools = await Promise.all(
      roles.map((role) =>
        createSchool(database!, {
          organizationId: organization.id,
          name: role,
        }),
      ),
    )

    try {
      for (const [index, role] of roles.entries()) {
        const school = schools[index]!
        const assignment = await assignUserToSchool(database!, {
          userId: user.id,
          schoolId: school.id,
          role,
        })
        expect(
          await findSchoolMembership(database!, user.id, school.id),
        ).toEqual(assignment)
        expect(await hasSchoolRole(database!, user.id, school.id, role)).toBe(
          true,
        )
        expect(
          await hasSchoolRole(
            database!,
            user.id,
            school.id,
            role === 'teacher' ? 'approver' : 'teacher',
          ),
        ).toBe(false)
        expect(
          await listStaffAssignmentsForSchool(database!, school.id),
        ).toEqual([{ user, role }])
      }

      const assignments = await listSchoolAssignmentsForUser(database!, user.id)
      expect(assignments).toHaveLength(4)
      expect(assignments.map(({ role }) => role).sort()).toEqual(
        [...roles].sort(),
      )
      await expect(
        assignUserToSchool(database!, {
          userId: user.id,
          schoolId: schools[0]!.id,
          role: 'teacher',
        }),
      ).rejects.toBeInstanceOf(DuplicateSchoolMembershipError)
    } finally {
      await database!.schoolMembership.deleteMany({
        where: { userId: user.id },
      })
      await database!.school.deleteMany({
        where: { organizationId: organization.id },
      })
      await database!.organization.delete({ where: { id: organization.id } })
      await database!.user.delete({ where: { id: user.id } })
    }
  })

  it('does not grant access to a different school', async () => {
    const user = await createUser(database!, {
      email: `staff-${randomUUID()}@example.test`,
      displayName: 'Assigned staff',
    })
    const organization = await createOrganization(database!, {
      name: 'Isolation office',
    })
    const allowed = await createSchool(database!, {
      organizationId: organization.id,
      name: 'Allowed school',
    })
    const other = await createSchool(database!, {
      organizationId: organization.id,
      name: 'Other school',
    })

    try {
      await assignUserToSchool(database!, {
        userId: user.id,
        schoolId: allowed.id,
        role: 'teacher',
      })
      expect(
        await findSchoolMembership(database!, user.id, other.id),
      ).toBeNull()
      expect(await hasSchoolRole(database!, user.id, other.id, 'teacher')).toBe(
        false,
      )
      expect(await listStaffAssignmentsForSchool(database!, other.id)).toEqual(
        [],
      )
      expect(
        (await listSchoolAssignmentsForUser(database!, user.id)).map(
          ({ school }) => school.id,
        ),
      ).toEqual([allowed.id])
    } finally {
      await database!.schoolMembership.deleteMany({
        where: { userId: user.id },
      })
      await database!.school.deleteMany({
        where: { organizationId: organization.id },
      })
      await database!.organization.delete({ where: { id: organization.id } })
      await database!.user.delete({ where: { id: user.id } })
    }
  })
})
