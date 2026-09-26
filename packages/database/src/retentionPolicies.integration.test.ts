import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import {
  createDatabaseClient,
  createRetentionPolicy,
  evaluateRetention,
  RetentionPermissionError,
  RetentionPolicyNotFoundError,
} from './index.js'

const testUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = testUrl
  ? createDatabaseClient({ DATABASE_URL: testUrl })
  : null

afterAll(async () => {
  await database?.$disconnect()
})

describe.skipIf(!database)('retention policies in PostgreSQL', () => {
  it('configures unique scoped policies and evaluates eligibility without deletion', async () => {
    const suffix = randomUUID()
    const organization = await database!.organization.create({
      data: { name: `Retention organization ${suffix}` },
    })
    const otherOrganization = await database!.organization.create({
      data: { name: `Other retention organization ${suffix}` },
    })
    const administrator = await database!.user.create({
      data: {
        email: `retention-administrator-${suffix}@example.test`,
        displayName: 'Retention administrator',
      },
    })
    await database!.organizationMembership.create({
      data: {
        userId: administrator.id,
        organizationId: organization.id,
        role: 'administrator',
      },
    })
    const evaluatedAt = new Date('2026-09-26T12:00:00.000Z')
    try {
      await expect(
        createRetentionPolicy(database!, administrator.id, {
          organizationId: organization.id,
          category: 'auditEvents',
          retentionDays: 0,
        }),
      ).rejects.toThrow()
      await expect(
        createRetentionPolicy(database!, administrator.id, {
          organizationId: otherOrganization.id,
          category: 'auditEvents',
          retentionDays: 30,
        }),
      ).rejects.toBeInstanceOf(RetentionPermissionError)
      const policy = await createRetentionPolicy(database!, administrator.id, {
        organizationId: organization.id,
        category: 'auditEvents',
        retentionDays: 30,
      })
      await expect(
        evaluateRetention(
          database!,
          administrator.id,
          organization.id,
          'messages',
          evaluatedAt,
        ),
      ).rejects.toBeInstanceOf(RetentionPolicyNotFoundError)
      const oldEvent = await database!.auditEvent.create({
        data: {
          organizationId: organization.id,
          action: 'account.provisioned',
          resourceType: 'user',
          resourceId: randomUUID(),
          occurredAt: new Date('2025-01-01T00:00:00.000Z'),
        },
      })
      await database!.auditEvent.create({
        data: {
          organizationId: organization.id,
          action: 'account.provisioned',
          resourceType: 'user',
          resourceId: randomUUID(),
          occurredAt: new Date('2026-09-25T00:00:00.000Z'),
        },
      })
      const before = await database!.auditEvent.count({
        where: { organizationId: organization.id },
      })
      const evaluation = await evaluateRetention(
        database!,
        administrator.id,
        organization.id,
        'auditEvents',
        evaluatedAt,
      )
      expect(evaluation).toMatchObject({
        category: 'auditEvents',
        retentionDays: 30,
        eligibleCount: 1,
        oldestEligibleAt: oldEvent.occurredAt,
      })
      expect(
        await database!.auditEvent.count({
          where: { organizationId: organization.id },
        }),
      ).toBe(before)
      const updated = await createRetentionPolicy(database!, administrator.id, {
        organizationId: organization.id,
        category: 'auditEvents',
        retentionDays: 60,
      })
      expect(updated.id).toBe(policy.id)
      expect(
        await database!.retentionPolicy.count({
          where: {
            organizationId: organization.id,
            category: 'auditEvents',
          },
        }),
      ).toBe(1)
      expect(
        await database!.auditEvent.count({
          where: {
            organizationId: organization.id,
            action: {
              in: ['retentionPolicy.created', 'retentionPolicy.updated'],
            },
          },
        }),
      ).toBe(2)
    } finally {
      await database!.auditEvent.deleteMany({
        where: { organizationId: organization.id },
      })
      await database!.retentionPolicy.deleteMany({
        where: { organizationId: organization.id },
      })
      await database!.organizationMembership.deleteMany({
        where: { organizationId: organization.id },
      })
      await database!.user.delete({ where: { id: administrator.id } })
      await database!.organization.deleteMany({
        where: { id: { in: [organization.id, otherOrganization.id] } },
      })
    }
  })
})
