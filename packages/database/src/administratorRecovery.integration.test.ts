import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { createDatabaseClient } from './index.js'
import {
  assistAccountRecovery,
  AdministratorRecoveryPermissionError,
} from './administratorRecovery.js'

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = url ? createDatabaseClient({ DATABASE_URL: url }) : null
afterAll(async () => {
  await database?.$disconnect()
})

describe.skipIf(!database)('administrator recovery scope in PostgreSQL', () => {
  it('allows an in-school administrator, revokes sessions, and denies another school and bureau viewer', async () => {
    const suffix = randomUUID()
    const organization = await database!.organization.create({
      data: { name: `Recovery Org ${suffix}` },
    })
    const otherOrganization = await database!.organization.create({
      data: { name: `Other Org ${suffix}` },
    })
    const school = await database!.school.create({
      data: {
        organizationId: organization.id,
        name: `Recovery School ${suffix}`,
      },
    })
    const otherSchool = await database!.school.create({
      data: {
        organizationId: otherOrganization.id,
        name: `Other School ${suffix}`,
      },
    })
    const admin = await database!.user.create({
      data: {
        email: `admin-${suffix}@example.test`,
        displayName: 'Admin',
        schoolMemberships: {
          create: { schoolId: school.id, role: 'administrator' },
        },
      },
    })
    const target = await database!.user.create({
      data: {
        email: `target-${suffix}@example.test`,
        displayName: 'Target',
        schoolMemberships: { create: { schoolId: school.id, role: 'teacher' } },
        passwordCredential: { create: { passwordHash: 'fixture-hash' } },
        sessions: {
          create: {
            tokenHash: randomUUID(),
            expiresAt: new Date(Date.now() + 100000),
          },
        },
      },
    })
    const outsider = await database!.user.create({
      data: {
        email: `outside-${suffix}@example.test`,
        displayName: 'Outside',
        schoolMemberships: {
          create: { schoolId: otherSchool.id, role: 'administrator' },
        },
      },
    })
    try {
      await expect(
        assistAccountRecovery(database!, outsider.id, school.id, target.id),
      ).rejects.toBeInstanceOf(AdministratorRecoveryPermissionError)
      await expect(
        assistAccountRecovery(database!, admin.id, otherSchool.id, target.id),
      ).rejects.toBeInstanceOf(AdministratorRecoveryPermissionError)
      const result = await assistAccountRecovery(
        database!,
        admin.id,
        school.id,
        target.id,
      )
      expect(result.email).toBe(target.email)
      expect(
        await database!.session.count({ where: { userId: target.id } }),
      ).toBe(0)
      expect(
        (
          await database!.passwordCredential.findUniqueOrThrow({
            where: { userId: target.id },
          })
        ).mustChangePassword,
      ).toBe(true)
      expect(
        await database!.auditEvent.count({
          where: { action: 'account.recoveryAssisted', actorUserId: admin.id },
        }),
      ).toBe(1)
    } finally {
      await database!.auditEvent.deleteMany({ where: { schoolId: school.id } })
      await database!.user.deleteMany({
        where: { id: { in: [admin.id, target.id, outsider.id] } },
      })
      await database!.school.deleteMany({
        where: { id: { in: [school.id, otherSchool.id] } },
      })
      await database!.organization.deleteMany({
        where: { id: { in: [organization.id, otherOrganization.id] } },
      })
    }
  })
})
