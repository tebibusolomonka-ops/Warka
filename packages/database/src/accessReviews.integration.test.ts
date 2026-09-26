import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import {
  AccessReviewPermissionError,
  completeAccessReview,
  createDatabaseClient,
  getAccessReview,
  setAccessReviewDecision,
  startAccessReview,
} from './index.js'

const testUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = testUrl
  ? createDatabaseClient({ DATABASE_URL: testUrl })
  : null

afterAll(async () => {
  await database?.$disconnect()
})

describe.skipIf(!database)('access reviews in PostgreSQL', () => {
  it('captures privileged access and applies only explicit revocations on completion', async () => {
    const suffix = randomUUID()
    const organization = await database!.organization.create({
      data: { name: `Review organization ${suffix}` },
    })
    const otherOrganization = await database!.organization.create({
      data: { name: `Other review organization ${suffix}` },
    })
    const school = await database!.school.create({
      data: { organizationId: organization.id, name: 'Review school' },
    })
    const [actor, administrator, teacher, bureauUser] = await Promise.all(
      ['actor', 'administrator', 'teacher', 'bureau'].map((name) =>
        database!.user.create({
          data: {
            email: `${name}-${suffix}@example.test`,
            displayName: name,
          },
        }),
      ),
    )
    await database!.organizationMembership.createMany({
      data: [
        { userId: actor!.id, organizationId: organization.id, role: 'owner' },
        {
          userId: administrator!.id,
          organizationId: organization.id,
          role: 'administrator',
        },
      ],
    })
    await database!.schoolMembership.create({
      data: { userId: teacher!.id, schoolId: school.id, role: 'teacher' },
    })
    await database!.bureauAccess.create({
      data: {
        userId: bureauUser!.id,
        organizationId: organization.id,
        role: 'viewer',
      },
    })
    try {
      await expect(
        startAccessReview(database!, actor!.id, {
          organizationId: otherOrganization.id,
        }),
      ).rejects.toBeInstanceOf(AccessReviewPermissionError)
      const review = await startAccessReview(database!, actor!.id, {
        organizationId: organization.id,
      })
      expect(review.entries).toHaveLength(4)
      expect(review.entries.map((entry) => entry.currentRole).sort()).toEqual([
        'administrator',
        'owner',
        'teacher',
        'viewer',
      ])
      expect(
        await database!.schoolMembership.findUnique({
          where: {
            userId_schoolId: { userId: teacher!.id, schoolId: school.id },
          },
        }),
      ).not.toBeNull()
      const teacherEntry = review.entries.find(
        (entry) => entry.userId === teacher!.id,
      )!
      await expect(
        setAccessReviewDecision(
          database!,
          actor!.id,
          review.id,
          teacherEntry.id,
          'grant',
        ),
      ).rejects.toThrow()
      for (const entry of review.entries)
        await setAccessReviewDecision(
          database!,
          actor!.id,
          review.id,
          entry.id,
          entry.id === teacherEntry.id ? 'revoke' : 'confirmed',
        )
      expect(
        await database!.schoolMembership.findUnique({
          where: {
            userId_schoolId: { userId: teacher!.id, schoolId: school.id },
          },
        }),
      ).not.toBeNull()
      const completed = await completeAccessReview(
        database!,
        actor!.id,
        review.id,
      )
      expect(completed.status).toBe('completed')
      expect(
        await database!.schoolMembership.findUnique({
          where: {
            userId_schoolId: { userId: teacher!.id, schoolId: school.id },
          },
        }),
      ).toBeNull()
      expect(
        await database!.organizationMembership.findUnique({
          where: {
            userId_organizationId: {
              userId: administrator!.id,
              organizationId: organization.id,
            },
          },
        }),
      ).not.toBeNull()
      const history = await getAccessReview(database!, actor!.id, review.id)
      expect(history.entries).toHaveLength(4)
      expect(
        history.entries.find((entry) => entry.id === teacherEntry.id)?.decision,
      ).toBe('revoke')
      expect(
        await database!.auditEvent.count({
          where: { resourceType: 'accessReview', resourceId: review.id },
        }),
      ).toBe(2)
    } finally {
      await database!.auditEvent.deleteMany({
        where: { organizationId: organization.id },
      })
      await database!.accessReview.deleteMany({
        where: { organizationId: organization.id },
      })
      await database!.bureauAccess.deleteMany({
        where: { organizationId: organization.id },
      })
      await database!.schoolMembership.deleteMany({
        where: { schoolId: school.id },
      })
      await database!.organizationMembership.deleteMany({
        where: { organizationId: organization.id },
      })
      await database!.school.delete({ where: { id: school.id } })
      await database!.user.deleteMany({
        where: {
          id: {
            in: [actor!.id, administrator!.id, teacher!.id, bureauUser!.id],
          },
        },
      })
      await database!.organization.deleteMany({
        where: { id: { in: [organization.id, otherOrganization.id] } },
      })
    }
  })
})
