import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { createDatabaseClient } from './index.js'
import {
  offboardStaff,
  StaffOffboardingPermissionError,
} from './staffOffboarding.js'

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = url ? createDatabaseClient({ DATABASE_URL: url }) : null
afterAll(async () => {
  await database?.$disconnect()
})

describe.skipIf(!database)('staff offboarding in PostgreSQL', () => {
  it('rolls back unauthorized actions and ends only selected school access while preserving records', async () => {
    const suffix = randomUUID()
    const org = await database!.organization.create({
      data: { name: `Offboarding Org ${suffix}` },
    })
    const school = await database!.school.create({
      data: { organizationId: org.id, name: `Leaving School ${suffix}` },
    })
    const other = await database!.school.create({
      data: { organizationId: org.id, name: `Other School ${suffix}` },
    })
    const admin = await database!.user.create({
      data: {
        email: `offboard-admin-${suffix}@example.test`,
        displayName: 'Admin',
        schoolMemberships: {
          create: { schoolId: school.id, role: 'administrator' },
        },
      },
    })
    const target = await database!.user.create({
      data: {
        email: `offboard-target-${suffix}@example.test`,
        displayName: 'Teacher',
        schoolMemberships: {
          create: [
            { schoolId: school.id, role: 'teacher' },
            { schoolId: other.id, role: 'teacher' },
          ],
        },
        sessions: {
          create: {
            tokenHash: randomUUID(),
            expiresAt: new Date(Date.now() + 60000),
          },
        },
      },
    })
    const outsider = await database!.user.create({
      data: {
        email: `offboard-outsider-${suffix}@example.test`,
        displayName: 'Outsider',
      },
    })
    const year = await database!.academicYear.create({
      data: {
        schoolId: school.id,
        name: 'Current',
        startsOn: new Date('2026-01-01'),
        endsOn: new Date('2026-12-31'),
      },
    })
    const grade = await database!.gradeLevel.create({
      data: { schoolId: school.id, name: 'Grade' },
    })
    const schoolClass = await database!.schoolClass.create({
      data: {
        schoolId: school.id,
        academicYearId: year.id,
        gradeLevelId: grade.id,
        name: 'Class',
      },
    })
    const subject = await database!.subject.create({
      data: { schoolId: school.id, name: 'Subject' },
    })
    const assignment = await database!.teachingAssignment.create({
      data: {
        schoolId: school.id,
        userId: target.id,
        academicYearId: year.id,
        schoolClassId: schoolClass.id,
        subjectId: subject.id,
      },
    })
    try {
      const input = {
        actorUserId: admin.id,
        targetUserId: target.id,
        schoolId: school.id,
        reason: 'Employment ended',
      }
      await expect(
        offboardStaff(database!, { ...input, actorUserId: outsider.id }),
      ).rejects.toBeInstanceOf(StaffOffboardingPermissionError)
      expect(
        (
          await database!.schoolMembership.findUniqueOrThrow({
            where: {
              userId_schoolId: { userId: target.id, schoolId: school.id },
            },
          })
        ).endsAt,
      ).toBeNull()
      const result = await offboardStaff(database!, input)
      expect(result).toEqual({
        schoolMembershipEnded: true,
        organizationMembershipEnded: false,
        assignmentsEnded: 1,
      })
      expect(
        await database!.session.count({ where: { userId: target.id } }),
      ).toBe(0)
      expect(
        (
          await database!.schoolMembership.findUniqueOrThrow({
            where: {
              userId_schoolId: { userId: target.id, schoolId: school.id },
            },
          })
        ).endsAt,
      ).not.toBeNull()
      expect(
        (
          await database!.schoolMembership.findUniqueOrThrow({
            where: {
              userId_schoolId: { userId: target.id, schoolId: other.id },
            },
          })
        ).endsAt,
      ).toBeNull()
      expect(
        (
          await database!.teachingAssignment.findUniqueOrThrow({
            where: { id: assignment.id },
          })
        ).endsAt,
      ).not.toBeNull()
      expect(
        await database!.auditEvent.count({
          where: { action: 'schoolStaff.offboarded', resourceId: target.id },
        }),
      ).toBe(1)
    } finally {
      await database!.auditEvent.deleteMany({ where: { schoolId: school.id } })
      await database!.teachingAssignment.delete({
        where: { id: assignment.id },
      })
      await database!.schoolClass.delete({ where: { id: schoolClass.id } })
      await database!.subject.delete({ where: { id: subject.id } })
      await database!.gradeLevel.delete({ where: { id: grade.id } })
      await database!.academicYear.delete({ where: { id: year.id } })
      await database!.user.deleteMany({
        where: { id: { in: [admin.id, target.id, outsider.id] } },
      })
      await database!.school.deleteMany({
        where: { id: { in: [school.id, other.id] } },
      })
      await database!.organization.delete({ where: { id: org.id } })
    }
  })
})
