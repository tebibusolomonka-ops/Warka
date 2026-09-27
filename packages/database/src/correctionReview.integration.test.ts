import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { createDatabaseClient } from './index.js'
import { createStudentCorrectionRequest } from './studentCorrectionRequests.js'
import { createEnrollmentCorrectionRequest } from './enrollmentCorrectionRequests.js'
import {
  reviewStudentCorrection,
  reviewEnrollmentCorrection,
  CorrectionPermissionError,
  CorrectionStateError,
} from './correctionReview.js'

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = url ? createDatabaseClient({ DATABASE_URL: url }) : null
afterAll(async () => {
  await database?.$disconnect()
})

describe.skipIf(!database)('correction review in PostgreSQL', () => {
  it('denies teacher and cross-school review, applies approved changes with prior values and enrollment history', async () => {
    const suffix = randomUUID()
    const org = await database!.organization.create({
      data: { name: `Review Org ${suffix}` },
    })
    const school = await database!.school.create({
      data: { organizationId: org.id, name: `Review School ${suffix}` },
    })
    const other = await database!.school.create({
      data: { organizationId: org.id, name: `Other Review School ${suffix}` },
    })
    const admin = await database!.user.create({
      data: {
        email: `review-admin-${suffix}@example.test`,
        displayName: 'Admin',
        schoolMemberships: {
          create: { schoolId: school.id, role: 'administrator' },
        },
      },
    })
    const registrar = await database!.user.create({
      data: {
        email: `review-registrar-${suffix}@example.test`,
        displayName: 'Registrar',
        schoolMemberships: {
          create: { schoolId: school.id, role: 'registrar' },
        },
      },
    })
    const teacher = await database!.user.create({
      data: {
        email: `review-teacher-${suffix}@example.test`,
        displayName: 'Teacher',
        schoolMemberships: { create: { schoolId: school.id, role: 'teacher' } },
      },
    })
    const year = await database!.academicYear.create({
      data: {
        schoolId: school.id,
        name: 'Review Year',
        startsOn: new Date('2026-01-01'),
        endsOn: new Date('2026-12-31'),
      },
    })
    const firstGrade = await database!.gradeLevel.create({
      data: { schoolId: school.id, name: 'First' },
    })
    const nextGrade = await database!.gradeLevel.create({
      data: { schoolId: school.id, name: 'Second' },
    })
    const student = await database!.student.create({
      data: {
        studentReference: `WKA-${suffix}`,
        givenName: 'Old',
        familyName: 'Name',
      },
    })
    const enrollment = await database!.enrollment.create({
      data: {
        studentId: student.id,
        schoolId: school.id,
        academicYearId: year.id,
        gradeLevelId: firstGrade.id,
        status: 'approved',
      },
    })
    try {
      const identity = await createStudentCorrectionRequest(
        database!,
        registrar.id,
        school.id,
        student.id,
        {
          field: 'givenName',
          proposedValue: 'Corrected',
          reason: 'Birth record evidence',
        },
      )
      await expect(
        reviewStudentCorrection(
          database!,
          teacher.id,
          school.id,
          identity.id,
          'approve',
        ),
      ).rejects.toBeInstanceOf(CorrectionPermissionError)
      await expect(
        reviewStudentCorrection(
          database!,
          admin.id,
          other.id,
          identity.id,
          'approve',
        ),
      ).rejects.toBeInstanceOf(CorrectionPermissionError)
      expect(
        (
          await database!.student.findUniqueOrThrow({
            where: { id: student.id },
          })
        ).givenName,
      ).toBe('Old')
      await reviewStudentCorrection(
        database!,
        admin.id,
        school.id,
        identity.id,
        'approve',
      )
      expect(
        (
          await database!.student.findUniqueOrThrow({
            where: { id: student.id },
          })
        ).givenName,
      ).toBe('Corrected')
      expect(
        (
          await database!.studentCorrectionRequest.findUniqueOrThrow({
            where: { id: identity.id },
          })
        ).previousValue,
      ).toBe('Old')
      await expect(
        reviewStudentCorrection(
          database!,
          admin.id,
          school.id,
          identity.id,
          'approve',
        ),
      ).rejects.toBeInstanceOf(CorrectionStateError)

      const placement = await createEnrollmentCorrectionRequest(
        database!,
        registrar.id,
        school.id,
        enrollment.id,
        {
          proposedGradeLevelId: nextGrade.id,
          proposedSchoolClassId: null,
          reason: 'Placement record correction',
        },
      )
      await reviewEnrollmentCorrection(
        database!,
        admin.id,
        school.id,
        placement.id,
        'approve',
      )
      expect(
        (
          await database!.enrollment.findUniqueOrThrow({
            where: { id: enrollment.id },
          })
        ).gradeLevelId,
      ).toBe(nextGrade.id)
      const history = await database!.enrollmentHistoryEvent.findFirstOrThrow({
        where: { enrollmentId: enrollment.id, eventType: 'gradeChanged' },
        orderBy: { createdAt: 'desc' },
      })
      expect(history.previousGradeLevelId).toBe(firstGrade.id)
      expect(history.newGradeLevelId).toBe(nextGrade.id)
      expect(history.performedById).toBe(admin.id)
      expect(
        await database!.auditEvent.count({
          where: {
            actorUserId: admin.id,
            action: {
              in: [
                'studentCorrection.approved',
                'enrollmentCorrection.approved',
              ],
            },
          },
        }),
      ).toBe(2)
    } finally {
      await database!.auditEvent.deleteMany({
        where: { schoolId: { in: [school.id, other.id] } },
      })
      await database!.studentCorrectionRequest.deleteMany({
        where: { studentId: student.id },
      })
      await database!.enrollmentCorrectionRequest.deleteMany({
        where: { enrollmentId: enrollment.id },
      })
      await database!.enrollmentHistoryEvent.deleteMany({
        where: { enrollmentId: enrollment.id },
      })
      await database!.enrollment.delete({ where: { id: enrollment.id } })
      await database!.student.delete({ where: { id: student.id } })
      await database!.gradeLevel.deleteMany({ where: { schoolId: school.id } })
      await database!.academicYear.delete({ where: { id: year.id } })
      await database!.user.deleteMany({
        where: { id: { in: [admin.id, registrar.id, teacher.id] } },
      })
      await database!.school.deleteMany({
        where: { id: { in: [school.id, other.id] } },
      })
      await database!.organization.delete({ where: { id: org.id } })
    }
  })
})
