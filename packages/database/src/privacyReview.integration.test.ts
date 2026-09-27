import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { createDatabaseClient } from './index.js'
import { createPrivacyRequest } from './privacyRequests.js'
import { reviewPrivacyRequest } from './privacyReview.js'

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = url ? createDatabaseClient({ DATABASE_URL: url }) : null
afterAll(async () => {
  await database?.$disconnect()
})

describe.skipIf(!database)('privacy review in PostgreSQL', () => {
  it('requires a scoped administrator and preserves requester ownership', async () => {
    const suffix = randomUUID()
    const organization = await database!.organization.create({
      data: { name: `Privacy ${suffix}` },
    })
    const school = await database!.school.create({
      data: { name: 'Privacy school', organizationId: organization.id },
    })
    const student = await database!.student.create({
      data: { studentReference: `PRIV-${suffix}`, givenName: 'Hana' },
    })
    const studentUser = await database!.user.create({
      data: {
        email: `privacy-student-${suffix}@example.test`,
        displayName: 'Student',
      },
    })
    const admin = await database!.user.create({
      data: {
        email: `privacy-admin-${suffix}@example.test`,
        displayName: 'Admin',
      },
    })
    const teacher = await database!.user.create({
      data: {
        email: `privacy-teacher-${suffix}@example.test`,
        displayName: 'Teacher',
      },
    })
    try {
      const year = await database!.academicYear.create({
        data: {
          schoolId: school.id,
          name: 'Year',
          startsOn: new Date('2026-01-01'),
          endsOn: new Date('2026-12-31'),
        },
      })
      const grade = await database!.gradeLevel.create({
        data: { schoolId: school.id, name: 'Grade' },
      })
      await database!.enrollment.create({
        data: {
          studentId: student.id,
          schoolId: school.id,
          academicYearId: year.id,
          gradeLevelId: grade.id,
          status: 'approved',
        },
      })
      await database!.studentAccess.create({
        data: { studentId: student.id, userId: studentUser.id },
      })
      await database!.schoolMembership.createMany({
        data: [
          { userId: admin.id, schoolId: school.id, role: 'administrator' },
          { userId: teacher.id, schoolId: school.id, role: 'teacher' },
        ],
      })
      const request = await createPrivacyRequest(database!, studentUser.id, {
        schoolId: school.id,
        studentId: student.id,
        type: 'access',
        details: 'Please provide my records',
      })
      await expect(
        reviewPrivacyRequest(database!, teacher.id, request.id, 'approve'),
      ).rejects.toThrow()
      const approved = await reviewPrivacyRequest(
        database!,
        admin.id,
        request.id,
        'approve',
      )
      expect(approved.status).toBe('approved')
      expect(approved.requesterUserId).toBe(studentUser.id)
    } finally {
      await database!.auditEvent.deleteMany({ where: { schoolId: school.id } })
      await database!.privacyRequest.deleteMany({
        where: { schoolId: school.id },
      })
      await database!.studentAccess.deleteMany({
        where: { studentId: student.id },
      })
      await database!.enrollment.deleteMany({ where: { schoolId: school.id } })
      await database!.gradeLevel.deleteMany({ where: { schoolId: school.id } })
      await database!.academicYear.deleteMany({
        where: { schoolId: school.id },
      })
      await database!.schoolMembership.deleteMany({
        where: { schoolId: school.id },
      })
      await database!.student.delete({ where: { id: student.id } })
      await database!.user.deleteMany({
        where: { id: { in: [studentUser.id, admin.id, teacher.id] } },
      })
      await database!.school.delete({ where: { id: school.id } })
      await database!.organization.delete({ where: { id: organization.id } })
    }
  })
})
