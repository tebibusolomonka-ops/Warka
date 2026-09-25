import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { createDatabaseClient } from './index.js'
import { linkGuardianToStudent } from './guardians.js'
import { linkGuardianUser } from './guardianAccess.js'
import { verifyGuardianRelationship } from './guardianRelationships.js'
import {
  canAccessParentChild,
  getParentPortalSetting,
  ParentServicePermissionError,
  setParentPortalEnabled,
} from './parentService.js'

const testUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = testUrl
  ? createDatabaseClient({ DATABASE_URL: testUrl })
  : null

afterAll(async () => {
  await database?.$disconnect()
})

describe.skipIf(!database)('parent portal school access in PostgreSQL', () => {
  it('requires an enabled school and a verified guardian relationship', async () => {
    const suffix = randomUUID()
    const organization = await database!.organization.create({
      data: { name: `Parent service ${suffix}` },
    })
    const school = await database!.school.create({
      data: { organizationId: organization.id, name: 'Parent school' },
    })
    const otherSchool = await database!.school.create({
      data: { organizationId: organization.id, name: 'Other school' },
    })
    const admin = await database!.user.create({
      data: { email: `admin-${suffix}@example.test`, displayName: 'Admin' },
    })
    const teacher = await database!.user.create({
      data: { email: `teacher-${suffix}@example.test`, displayName: 'Teacher' },
    })
    const guardianUser = await database!.user.create({
      data: {
        email: `guardian-${suffix}@example.test`,
        displayName: 'Guardian',
      },
    })
    const guardian = await database!.guardian.create({
      data: { name: 'Guardian' },
    })
    const student = await database!.student.create({
      data: { studentReference: `PORTAL-${suffix}`, givenName: 'Child' },
    })
    try {
      await database!.schoolMembership.createMany({
        data: [
          { userId: admin.id, schoolId: school.id, role: 'administrator' },
          { userId: teacher.id, schoolId: school.id, role: 'teacher' },
        ],
      })
      const year = await database!.academicYear.create({
        data: {
          schoolId: school.id,
          name: 'Year',
          startsOn: new Date('2025-01-01'),
          endsOn: new Date('2026-12-31'),
        },
      })
      const grade = await database!.gradeLevel.create({
        data: { schoolId: school.id, name: 'Grade' },
      })
      await database!.enrollment.create({
        data: {
          schoolId: school.id,
          studentId: student.id,
          academicYearId: year.id,
          gradeLevelId: grade.id,
          status: 'approved',
          approvedAt: new Date(),
          approvedById: admin.id,
        },
      })
      await linkGuardianToStudent(database!, {
        studentId: student.id,
        guardianId: guardian.id,
        relationship: 'Parent',
      })
      await linkGuardianUser(database!, guardianUser.id, guardian.id)
      expect(
        await getParentPortalSetting(database!, admin.id, school.id),
      ).toEqual({ parentPortalEnabled: false, enabledAt: null })
      expect(
        await canAccessParentChild(
          database!,
          guardianUser.id,
          school.id,
          student.id,
        ),
      ).toBe(false)
      await expect(
        setParentPortalEnabled(database!, teacher.id, school.id, true),
      ).rejects.toBeInstanceOf(ParentServicePermissionError)
      await expect(
        setParentPortalEnabled(database!, admin.id, otherSchool.id, true),
      ).rejects.toBeInstanceOf(ParentServicePermissionError)
      await setParentPortalEnabled(database!, admin.id, school.id, true)
      expect(
        await canAccessParentChild(
          database!,
          guardianUser.id,
          school.id,
          student.id,
        ),
      ).toBe(false)
      await verifyGuardianRelationship(
        database!,
        admin.id,
        school.id,
        student.id,
        guardian.id,
      )
      expect(
        await canAccessParentChild(
          database!,
          guardianUser.id,
          school.id,
          student.id,
        ),
      ).toBe(true)
      expect(
        await canAccessParentChild(
          database!,
          guardianUser.id,
          otherSchool.id,
          student.id,
        ),
      ).toBe(false)
      await setParentPortalEnabled(database!, admin.id, school.id, false)
      expect(
        await canAccessParentChild(
          database!,
          guardianUser.id,
          school.id,
          student.id,
        ),
      ).toBe(false)
      expect(
        await database!.studentGuardian.count({
          where: { studentId: student.id },
        }),
      ).toBe(1)
    } finally {
      await database!.schoolServiceAccess.deleteMany({
        where: { schoolId: school.id },
      })
      await database!.guardianAccess.deleteMany({
        where: { guardianId: guardian.id },
      })
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
        where: { id: { in: [admin.id, teacher.id, guardianUser.id] } },
      })
      await database!.school.deleteMany({
        where: { id: { in: [school.id, otherSchool.id] } },
      })
      await database!.organization.delete({ where: { id: organization.id } })
    }
  })
})
