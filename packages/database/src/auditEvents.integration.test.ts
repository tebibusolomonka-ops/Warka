import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import {
  createDatabaseClient,
  createOrganization,
  createSchool,
  createUser,
  listAuditEvents,
  recordAuditEvent,
} from './index.js'

const testUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = testUrl
  ? createDatabaseClient({ DATABASE_URL: testUrl })
  : null

afterAll(async () => {
  await database?.$disconnect()
})

describe.skipIf(!database)('audit events in PostgreSQL', () => {
  it('persists immutable, ordered, and scoped records with safe metadata', async () => {
    const suffix = randomUUID()
    const organization = await createOrganization(database!, {
      name: `Audit scope ${suffix}`,
    })
    const otherOrganization = await createOrganization(database!, {
      name: `Other audit scope ${suffix}`,
    })
    const school = await createSchool(database!, {
      organizationId: organization.id,
      name: 'Audit school',
    })
    const actor = await createUser(database!, {
      email: `audit-actor-${suffix}@example.test`,
      displayName: 'Audit actor',
    })
    try {
      const first = await recordAuditEvent(database!, {
        organizationId: organization.id,
        schoolId: school.id,
        actorUserId: actor.id,
        action: 'membership.changed',
        resourceType: 'membership',
        resourceId: 'membership-1',
        metadata: { role: 'administrator', source: 'integration' },
        occurredAt: new Date('2026-01-01T09:00:00.000Z'),
      })
      const second = await recordAuditEvent(database!, {
        organizationId: organization.id,
        actorUserId: actor.id,
        action: 'account.provisioned',
        resourceType: 'user',
        resourceId: actor.id,
        metadata: { channel: 'administration' },
        occurredAt: new Date('2026-01-01T10:00:00.000Z'),
      })
      await recordAuditEvent(database!, {
        organizationId: otherOrganization.id,
        action: 'retentionPolicy.created',
        resourceType: 'retentionPolicy',
        resourceId: 'other-policy',
      })

      expect(
        (
          await listAuditEvents(database!, { organizationId: organization.id })
        ).map((event) => event.id),
      ).toEqual([second.id, first.id])
      expect(
        await listAuditEvents(database!, {
          schoolId: school.id,
          action: 'membership.changed',
        }),
      ).toMatchObject([
        {
          id: first.id,
          metadata: { role: 'administrator', source: 'integration' },
        },
      ])
      expect(
        await database!.auditEvent.count({
          where: { organizationId: otherOrganization.id },
        }),
      ).toBe(1)
      expect(() => listAuditEvents(database!, {})).toThrow(
        'Audit query requires an organization or school scope',
      )
      expect(() =>
        recordAuditEvent(database!, {
          organizationId: organization.id,
          action: 'account.provisioned',
          resourceType: 'user',
          metadata: { accessToken: 'must-never-be-stored' },
        }),
      ).toThrow('Sensitive audit metadata is forbidden')
      expect(
        await database!.auditEvent.findUniqueOrThrow({
          where: { id: first.id },
        }),
      ).toMatchObject({
        action: 'membership.changed',
        resourceId: 'membership-1',
      })
    } finally {
      await database!.auditEvent.deleteMany({
        where: {
          organizationId: { in: [organization.id, otherOrganization.id] },
        },
      })
      await database!.school.delete({ where: { id: school.id } })
      await database!.user.delete({ where: { id: actor.id } })
      await database!.organization.deleteMany({
        where: { id: { in: [organization.id, otherOrganization.id] } },
      })
    }
  })
})
