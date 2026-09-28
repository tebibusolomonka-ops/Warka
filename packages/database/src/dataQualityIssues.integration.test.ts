import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { createDatabaseClient } from './index.js'
import {
  DataQualityIssueAccessError,
  DataQualityIssueStateError,
  dismissDataQualityIssue,
} from './dataQualityIssues.js'

const testUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = testUrl
  ? createDatabaseClient({ DATABASE_URL: testUrl })
  : null
afterAll(async () => database?.$disconnect())

describe.skipIf(!database)('data quality issues in PostgreSQL', () => {
  it('persists factual issues and permits only reasoned non-blocking dismissal by school administration', async () => {
    const db = database!
    const organization = await db.organization.create({
      data: { name: `Quality ${randomUUID()}` },
    })
    const school = await db.school.create({
      data: { organizationId: organization.id, name: 'Quality school' },
    })
    const otherSchool = await db.school.create({
      data: { organizationId: organization.id, name: 'Other school' },
    })
    const admin = await db.user.create({
      data: { email: `${randomUUID()}@example.test`, displayName: 'Admin' },
    })
    const teacher = await db.user.create({
      data: { email: `${randomUUID()}@example.test`, displayName: 'Teacher' },
    })
    try {
      await db.schoolMembership.createMany({
        data: [
          {
            schoolId: school.id,
            userId: admin.id,
            role: 'administrator',
            startsAt: new Date('2026-01-01'),
          },
          {
            schoolId: school.id,
            userId: teacher.id,
            role: 'teacher',
            startsAt: new Date('2026-01-01'),
          },
        ],
      })
      const warning = await db.dataQualityIssue.create({
        data: {
          schoolId: school.id,
          category: 'student',
          severity: 'warning',
          code: 'STUDENT_DUPLICATE_CANDIDATE',
          summary: 'Potential duplicate requires review',
          entityType: 'student',
          entityId: randomUUID(),
        },
      })
      const blocking = await db.dataQualityIssue.create({
        data: {
          schoolId: school.id,
          category: 'enrollment',
          severity: 'blocking',
          code: 'ENROLLMENT_CONTEXT_INVALID',
          summary: 'Enrollment context requires review',
        },
      })
      await expect(
        dismissDataQualityIssue(db, teacher.id, {
          schoolId: school.id,
          issueId: warning.id,
          reason: 'Reviewed',
        }),
      ).rejects.toBeInstanceOf(DataQualityIssueAccessError)
      await expect(
        dismissDataQualityIssue(db, admin.id, {
          schoolId: otherSchool.id,
          issueId: warning.id,
          reason: 'Reviewed',
        }),
      ).rejects.toBeInstanceOf(DataQualityIssueAccessError)
      await expect(
        dismissDataQualityIssue(db, admin.id, {
          schoolId: school.id,
          issueId: blocking.id,
          reason: 'Reviewed',
        }),
      ).rejects.toBeInstanceOf(DataQualityIssueStateError)
      await expect(
        dismissDataQualityIssue(db, admin.id, {
          schoolId: school.id,
          issueId: warning.id,
          reason: '',
        }),
      ).rejects.toThrow()
      const dismissed = await dismissDataQualityIssue(db, admin.id, {
        schoolId: school.id,
        issueId: warning.id,
        reason: 'Reviewed with registrar',
      })
      expect(dismissed.status).toBe('dismissed')
      expect(dismissed.dismissedById).toBe(admin.id)
      expect(dismissed.dismissalReason).toBe('Reviewed with registrar')
      expect(
        (
          await db.dataQualityIssue.findUniqueOrThrow({
            where: { id: blocking.id },
          })
        ).status,
      ).toBe('open')
    } finally {
      await db.auditEvent.deleteMany({ where: { schoolId: school.id } })
      await db.dataQualityIssue.deleteMany({
        where: { schoolId: { in: [school.id, otherSchool.id] } },
      })
      await db.schoolMembership.deleteMany({ where: { schoolId: school.id } })
      await db.user.deleteMany({
        where: { id: { in: [admin.id, teacher.id] } },
      })
      await db.school.deleteMany({
        where: { id: { in: [school.id, otherSchool.id] } },
      })
      await db.organization.delete({ where: { id: organization.id } })
    }
  })
})
