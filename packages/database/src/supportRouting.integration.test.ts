import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { createDatabaseClient } from './index.js'
import {
  createSupportRequest,
  SupportRequestPermissionError,
} from './supportRequests.js'
import {
  closeSupportRequest,
  getRoutedSupportRequest,
  listRoutedSupportRequests,
  replyToSupportRequest,
  resolveSupportRequest,
} from './supportRouting.js'

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = url ? createDatabaseClient({ DATABASE_URL: url }) : null
afterAll(async () => {
  await database?.$disconnect()
})

describe.skipIf(!database)('support routing in PostgreSQL', () => {
  it('allows only a scoped support grant to respond and resolve', async () => {
    const suffix = randomUUID()
    const org = await database!.organization.create({
      data: { name: `Support Routing ${suffix}` },
    })
    const school = await database!.school.create({
      data: { organizationId: org.id, name: `Support School ${suffix}` },
    })
    const other = await database!.school.create({
      data: { organizationId: org.id, name: `Unrelated School ${suffix}` },
    })
    const admin = await database!.user.create({
      data: {
        email: `routing-admin-${suffix}@example.test`,
        displayName: 'Admin',
        schoolMemberships: {
          create: { schoolId: school.id, role: 'administrator' },
        },
      },
    })
    const support = await database!.user.create({
      data: {
        email: `routing-support-${suffix}@example.test`,
        displayName: 'Support',
        supportIdentity: { create: {} },
      },
    })
    await database!.supportAccessGrant.create({
      data: {
        supportUserId: support.id,
        schoolId: school.id,
        reason: 'School request diagnostics',
        requestedById: admin.id,
        approvedById: admin.id,
        approvedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        status: 'approved',
      },
    })
    try {
      const request = await createSupportRequest(
        database!,
        admin.id,
        school.id,
        {
          category: 'technical',
          title: 'Cannot access dashboard',
          description: 'The dashboard reports an error.',
        },
      )
      expect(
        (await listRoutedSupportRequests(database!, support.id, school.id)).map(
          (item) => item.id,
        ),
      ).toContain(request.id)
      await expect(
        listRoutedSupportRequests(database!, support.id, other.id),
      ).rejects.toBeInstanceOf(SupportRequestPermissionError)
      await replyToSupportRequest(
        database!,
        support.id,
        school.id,
        request.id,
        'Please retry after clearing the pending task.',
      )
      expect(
        (
          await getRoutedSupportRequest(
            database!,
            admin.id,
            school.id,
            request.id,
          )
        ).messages,
      ).toHaveLength(1)
      expect(
        (
          await resolveSupportRequest(
            database!,
            support.id,
            school.id,
            request.id,
            'The pending task was corrected.',
          )
        ).status,
      ).toBe('resolved')
      expect(
        (await closeSupportRequest(database!, admin.id, school.id, request.id))
          .status,
      ).toBe('closed')
      expect(
        await database!.notification.count({
          where: { userId: admin.id, type: 'support.resolved' },
        }),
      ).toBe(1)
    } finally {
      await database!.notification.deleteMany({
        where: { userId: { in: [admin.id, support.id] } },
      })
      await database!.auditEvent.deleteMany({ where: { schoolId: school.id } })
      await database!.supportRequestMessage.deleteMany({
        where: { request: { schoolId: school.id } },
      })
      await database!.supportRequest.deleteMany({
        where: { schoolId: school.id },
      })
      await database!.supportAccessGrant.deleteMany({
        where: { schoolId: school.id },
      })
      await database!.user.deleteMany({
        where: { id: { in: [admin.id, support.id] } },
      })
      await database!.school.deleteMany({
        where: { id: { in: [school.id, other.id] } },
      })
      await database!.organization.delete({ where: { id: org.id } })
    }
  })
})
