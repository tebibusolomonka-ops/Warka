import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { createDatabaseClient } from './index.js'
import { linkGuardianToStudent, createGuardian } from './guardians.js'
import {
  GuardianRelationshipPermissionError,
  GuardianRelationshipStateError,
  hasActiveVerifiedGuardianRelationship,
  revokeGuardianRelationship,
  verifyGuardianRelationship,
} from './guardianRelationships.js'

const testUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = testUrl
  ? createDatabaseClient({ DATABASE_URL: testUrl })
  : null

afterAll(async () => {
  await database?.$disconnect()
})

describe.skipIf(!database)('guardian verification in PostgreSQL', () => {
  it('tracks verified and revoked state within the authorized school', async () => {
    const suffix = randomUUID()
    const organization = await database!.organization.create({
      data: { name: `Verification ${suffix}` },
    })
    const school = await database!.school.create({
      data: { organizationId: organization.id, name: 'Current school' },
    })
    const otherSchool = await database!.school.create({
      data: { organizationId: organization.id, name: 'Other school' },
    })
    const registrar = await database!.user.create({
      data: {
        email: `registrar-${suffix}@example.test`,
        displayName: 'Registrar',
      },
    })
    const teacher = await database!.user.create({
      data: { email: `teacher-${suffix}@example.test`, displayName: 'Teacher' },
    })
    const approver = await database!.user.create({
      data: {
        email: `approver-${suffix}@example.test`,
        displayName: 'Approver',
      },
    })
    const guardian = await createGuardian(database!, { name: 'Guardian' })
    const student = await database!.student.create({
      data: { studentReference: `VERIFY-${suffix}`, givenName: 'Child' },
    })
    try {
      await database!.schoolMembership.createMany({
        data: [
          { userId: registrar.id, schoolId: school.id, role: 'registrar' },
          { userId: teacher.id, schoolId: school.id, role: 'teacher' },
          { userId: approver.id, schoolId: school.id, role: 'approver' },
        ],
      })
      const year = await database!.academicYear.create({
        data: {
          schoolId: school.id,
          name: 'Current year',
          startsOn: new Date('2025-01-01'),
          endsOn: new Date('2026-12-31'),
        },
      })
      const grade = await database!.gradeLevel.create({
        data: { schoolId: school.id, name: 'Grade 1' },
      })
      await database!.enrollment.create({
        data: {
          studentId: student.id,
          schoolId: school.id,
          academicYearId: year.id,
          gradeLevelId: grade.id,
          status: 'approved',
          approvedById: registrar.id,
          approvedAt: new Date(),
        },
      })
      const pending = await linkGuardianToStudent(database!, {
        studentId: student.id,
        guardianId: guardian.id,
        relationship: 'Mother',
      })
      expect(pending.verificationStatus).toBe('pending')
      expect(
        await hasActiveVerifiedGuardianRelationship(
          database!,
          school.id,
          student.id,
          guardian.id,
        ),
      ).toBe(false)
      await expect(
        verifyGuardianRelationship(
          database!,
          teacher.id,
          school.id,
          student.id,
          guardian.id,
        ),
      ).rejects.toBeInstanceOf(GuardianRelationshipPermissionError)
      await expect(
        verifyGuardianRelationship(
          database!,
          approver.id,
          school.id,
          student.id,
          guardian.id,
        ),
      ).rejects.toBeInstanceOf(GuardianRelationshipPermissionError)
      await expect(
        verifyGuardianRelationship(
          database!,
          registrar.id,
          otherSchool.id,
          student.id,
          guardian.id,
        ),
      ).rejects.toBeInstanceOf(GuardianRelationshipPermissionError)
      const verified = await verifyGuardianRelationship(
        database!,
        registrar.id,
        school.id,
        student.id,
        guardian.id,
      )
      expect(verified.verificationStatus).toBe('verified')
      expect(verified.verificationSchoolId).toBe(school.id)
      expect(verified.verifiedById).toBe(registrar.id)
      expect(verified.verifiedAt).toBeInstanceOf(Date)
      expect(
        await hasActiveVerifiedGuardianRelationship(
          database!,
          school.id,
          student.id,
          guardian.id,
        ),
      ).toBe(true)
      expect(
        await hasActiveVerifiedGuardianRelationship(
          database!,
          otherSchool.id,
          student.id,
          guardian.id,
        ),
      ).toBe(false)
      await expect(
        verifyGuardianRelationship(
          database!,
          registrar.id,
          school.id,
          student.id,
          guardian.id,
        ),
      ).rejects.toBeInstanceOf(GuardianRelationshipStateError)
      const revoked = await revokeGuardianRelationship(
        database!,
        registrar.id,
        school.id,
        student.id,
        guardian.id,
        'Identity review',
      )
      expect(revoked.verificationStatus).toBe('revoked')
      expect(revoked.revokedById).toBe(registrar.id)
      expect(revoked.revokedAt).toBeInstanceOf(Date)
      expect(revoked.revocationReason).toBe('Identity review')
      expect(revoked.verifiedById).toBe(registrar.id)
      expect(
        await hasActiveVerifiedGuardianRelationship(
          database!,
          school.id,
          student.id,
          guardian.id,
        ),
      ).toBe(false)
    } finally {
      await database!.studentGuardian.deleteMany({
        where: { studentId: student.id },
      })
      await database!.enrollment.deleteMany({
        where: { studentId: student.id },
      })
      await database!.gradeLevel.deleteMany({ where: { schoolId: school.id } })
      await database!.academicYear.deleteMany({
        where: { schoolId: school.id },
      })
      await database!.schoolMembership.deleteMany({
        where: { schoolId: school.id },
      })
      await database!.student.delete({ where: { id: student.id } })
      await database!.guardian.delete({ where: { id: guardian.id } })
      await database!.user.deleteMany({
        where: { id: { in: [registrar.id, teacher.id, approver.id] } },
      })
      await database!.school.deleteMany({
        where: { id: { in: [school.id, otherSchool.id] } },
      })
      await database!.organization.delete({ where: { id: organization.id } })
    }
  })
})
