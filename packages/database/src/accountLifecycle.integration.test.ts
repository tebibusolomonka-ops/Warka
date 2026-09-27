import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { createDatabaseClient } from './index.js'
import {
  AccountLifecyclePermissionError,
  changeAccountStatus,
} from './accountLifecycle.js'

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = url ? createDatabaseClient({ DATABASE_URL: url }) : null
afterAll(async () => {
  await database?.$disconnect()
})

describe.skipIf(!database)('account lifecycle in PostgreSQL', () => {
  it('denies self and outside changes, audits transitions, and revokes sessions', async () => {
    const suffix = randomUUID()
    const organization = await database!.organization.create({
      data: { name: `Lifecycle Org ${suffix}` },
    })
    const school = await database!.school.create({
      data: {
        organizationId: organization.id,
        name: `Lifecycle School ${suffix}`,
      },
    })
    const admin = await database!.user.create({
      data: {
        email: `lifecycle-admin-${suffix}@example.test`,
        displayName: 'Administrator',
        schoolMemberships: {
          create: { schoolId: school.id, role: 'administrator' },
        },
      },
    })
    const target = await database!.user.create({
      data: {
        email: `lifecycle-target-${suffix}@example.test`,
        displayName: 'Staff',
        schoolMemberships: { create: { schoolId: school.id, role: 'teacher' } },
        sessions: {
          create: {
            tokenHash: randomUUID(),
            expiresAt: new Date(Date.now() + 60000),
          },
        },
      },
    })
    const outsider = await database!.user.create({
      data: {
        email: `lifecycle-outside-${suffix}@example.test`,
        displayName: 'Outsider',
      },
    })
    try {
      const change = {
        actorUserId: admin.id,
        targetUserId: target.id,
        schoolId: school.id,
        status: 'suspended' as const,
        reason: 'Staff access review',
      }
      await expect(
        changeAccountStatus(database!, { ...change, actorUserId: target.id }),
      ).rejects.toBeInstanceOf(AccountLifecyclePermissionError)
      await expect(
        changeAccountStatus(database!, { ...change, actorUserId: outsider.id }),
      ).rejects.toBeInstanceOf(AccountLifecyclePermissionError)
      expect((await changeAccountStatus(database!, change)).accountStatus).toBe(
        'suspended',
      )
      expect(
        await database!.session.count({ where: { userId: target.id } }),
      ).toBe(0)
      expect(
        await database!.auditEvent.count({
          where: { action: 'account.lifecycleChanged', resourceId: target.id },
        }),
      ).toBe(1)
      expect(
        (
          await changeAccountStatus(database!, {
            ...change,
            status: 'active',
            reason: 'Reinstated after review',
          })
        ).accountStatus,
      ).toBe('active')
    } finally {
      await database!.auditEvent.deleteMany({ where: { schoolId: school.id } })
      await database!.user.deleteMany({
        where: { id: { in: [admin.id, target.id, outsider.id] } },
      })
      await database!.school.delete({ where: { id: school.id } })
      await database!.organization.delete({ where: { id: organization.id } })
    }
  })
})
