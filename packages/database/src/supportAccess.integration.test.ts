import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import {
  approveSupportAccess,
  checkSupportAccess,
  createDatabaseClient,
  createSupportIdentity,
  requestSupportAccess,
  revokeSupportAccess,
  SupportAccessDeniedError,
  SupportAccessPermissionError,
  SupportAccessStateError,
} from './index.js'

const testUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = testUrl
  ? createDatabaseClient({ DATABASE_URL: testUrl })
  : null

afterAll(async () => {
  await database?.$disconnect()
})

describe.skipIf(!database)('temporary support access in PostgreSQL', () => {
  it('requires approval and enforces scope, expiration, revocation, identity, and audit history', async () => {
    const suffix = randomUUID()
    const organization = await database!.organization.create({
      data: { name: `Support organization ${suffix}` },
    })
    const firstSchool = await database!.school.create({
      data: { organizationId: organization.id, name: 'Supported school' },
    })
    const secondSchool = await database!.school.create({
      data: { organizationId: organization.id, name: 'Other school' },
    })
    const [administrator, supportUser, ordinaryUser] = await Promise.all(
      ['administrator', 'support', 'ordinary'].map((name) =>
        database!.user.create({
          data: {
            email: `${name}-${suffix}@example.test`,
            displayName: name,
          },
        }),
      ),
    )
    await database!.schoolMembership.createMany({
      data: [
        {
          userId: administrator!.id,
          schoolId: firstSchool.id,
          role: 'administrator',
        },
        {
          userId: ordinaryUser!.id,
          schoolId: firstSchool.id,
          role: 'teacher',
        },
      ],
    })
    await createSupportIdentity(database!, supportUser!.id)
    try {
      await expect(
        requestSupportAccess(database!, ordinaryUser!.id, {
          supportUserId: ordinaryUser!.id,
          schoolId: firstSchool.id,
          reason: 'Attempt to self-assign support',
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        }),
      ).rejects.toBeInstanceOf(SupportAccessPermissionError)
      await expect(
        requestSupportAccess(database!, supportUser!.id, {
          supportUserId: supportUser!.id,
          schoolId: firstSchool.id,
          reason: 'Unbounded diagnostic request',
          expiresAt: new Date(Date.now() + 25 * 60 * 60 * 1000),
        }),
      ).rejects.toBeInstanceOf(SupportAccessStateError)
      const pending = await requestSupportAccess(database!, supportUser!.id, {
        supportUserId: supportUser!.id,
        schoolId: firstSchool.id,
        reason: 'Investigate school configuration',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      })
      await expect(
        checkSupportAccess(database!, supportUser!.id, firstSchool.id),
      ).rejects.toBeInstanceOf(SupportAccessDeniedError)
      await expect(
        approveSupportAccess(database!, ordinaryUser!.id, pending.id),
      ).rejects.toBeInstanceOf(SupportAccessPermissionError)
      await approveSupportAccess(database!, administrator!.id, pending.id)
      expect(
        await checkSupportAccess(database!, supportUser!.id, firstSchool.id),
      ).toMatchObject({ id: pending.id, status: 'approved' })
      await expect(
        checkSupportAccess(database!, supportUser!.id, secondSchool.id),
      ).rejects.toBeInstanceOf(SupportAccessDeniedError)
      await revokeSupportAccess(database!, administrator!.id, pending.id)
      await expect(
        checkSupportAccess(database!, supportUser!.id, firstSchool.id),
      ).rejects.toBeInstanceOf(SupportAccessDeniedError)
      const expiring = await requestSupportAccess(database!, supportUser!.id, {
        supportUserId: supportUser!.id,
        schoolId: firstSchool.id,
        reason: 'Short diagnostic follow-up',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      })
      await approveSupportAccess(database!, administrator!.id, expiring.id)
      await database!.supportAccessGrant.update({
        where: { id: expiring.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      })
      await expect(
        checkSupportAccess(database!, supportUser!.id, firstSchool.id),
      ).rejects.toBeInstanceOf(SupportAccessDeniedError)
      expect(
        await database!.auditEvent.count({
          where: {
            schoolId: firstSchool.id,
            resourceType: 'supportAccessGrant',
          },
        }),
      ).toBe(5)
    } finally {
      await database!.auditEvent.deleteMany({
        where: { schoolId: firstSchool.id },
      })
      await database!.supportAccessGrant.deleteMany({
        where: { schoolId: firstSchool.id },
      })
      await database!.supportIdentity.delete({
        where: { userId: supportUser!.id },
      })
      await database!.schoolMembership.deleteMany({
        where: { schoolId: firstSchool.id },
      })
      await database!.school.deleteMany({
        where: { organizationId: organization.id },
      })
      await database!.user.deleteMany({
        where: {
          id: { in: [administrator!.id, supportUser!.id, ordinaryUser!.id] },
        },
      })
      await database!.organization.delete({ where: { id: organization.id } })
    }
  })
})
