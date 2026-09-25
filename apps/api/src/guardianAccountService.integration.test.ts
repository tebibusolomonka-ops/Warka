import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import {
  createDatabaseClient,
  linkGuardianToStudent,
  setParentPortalEnabled,
  verifyGuardianRelationship,
} from '@warka/database'
import {
  GuardianAccountConflictError,
  GuardianAccountUnavailableError,
  prismaGuardianAccountService,
} from './guardianAccountService.js'

const testUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = testUrl
  ? createDatabaseClient({ DATABASE_URL: testUrl })
  : null

afterAll(async () => {
  await database?.$disconnect()
})

describe.skipIf(!database)(
  'guardian account provisioning in PostgreSQL',
  () => {
    it('creates forced-change access atomically after verification and school enablement', async () => {
      const suffix = randomUUID()
      const organization = await database!.organization.create({
        data: { name: `Guardian provision ${suffix}` },
      })
      const school = await database!.school.create({
        data: { organizationId: organization.id, name: 'Provision school' },
      })
      const otherSchool = await database!.school.create({
        data: { organizationId: organization.id, name: 'Other school' },
      })
      const admin = await database!.user.create({
        data: {
          email: `provision-admin-${suffix}@example.test`,
          displayName: 'Admin',
        },
      })
      const teacher = await database!.user.create({
        data: {
          email: `provision-teacher-${suffix}@example.test`,
          displayName: 'Teacher',
        },
      })
      const guardian = await database!.guardian.create({
        data: { name: 'Guardian' },
      })
      const student = await database!.student.create({
        data: { studentReference: `PROVISION-${suffix}`, givenName: 'Child' },
      })
      const email = `parent-${suffix}@example.test`
      const service = prismaGuardianAccountService(database!)
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
          relationship: 'Mother',
        })
        const input = {
          guardianId: guardian.id,
          email,
          displayName: 'Parent',
          initialPassword: 'InitialPassphrase123!',
        }
        await expect(
          service.create(admin.id, school.id, input),
        ).rejects.toBeInstanceOf(GuardianAccountUnavailableError)
        await setParentPortalEnabled(database!, admin.id, school.id, true)
        await expect(
          service.create(admin.id, school.id, input),
        ).rejects.toBeInstanceOf(GuardianAccountUnavailableError)
        await verifyGuardianRelationship(
          database!,
          admin.id,
          school.id,
          student.id,
          guardian.id,
        )
        await expect(
          service.create(teacher.id, school.id, input),
        ).rejects.toBeInstanceOf(GuardianAccountUnavailableError)
        await expect(
          service.create(admin.id, otherSchool.id, input),
        ).rejects.toBeInstanceOf(GuardianAccountUnavailableError)
        const created = await service.create(admin.id, school.id, input)
        expect(created).toEqual({
          id: expect.any(String),
          email,
          displayName: 'Parent',
          mustChangePassword: true,
        })
        expect(JSON.stringify(created)).not.toContain(input.initialPassword)
        expect(
          await service.status(admin.id, school.id, guardian.id),
        ).toMatchObject({ status: 'active', email, mustChangePassword: true })
        const credential = await database!.passwordCredential.findUnique({
          where: { userId: created.id },
        })
        expect(credential?.passwordHash).not.toContain(input.initialPassword)
        expect(credential?.mustChangePassword).toBe(true)
        await expect(
          service.create(admin.id, school.id, {
            ...input,
            email: `second-${suffix}@example.test`,
          }),
        ).rejects.toBeInstanceOf(GuardianAccountConflictError)
        expect(
          await database!.user.count({
            where: { email: `second-${suffix}@example.test` },
          }),
        ).toBe(0)
      } finally {
        await database!.guardianAccess.deleteMany({
          where: { guardianId: guardian.id },
        })
        await database!.studentGuardian.deleteMany({
          where: { studentId: student.id },
        })
        await database!.enrollment.deleteMany({
          where: { studentId: student.id },
        })
        await database!.schoolServiceAccess.deleteMany({
          where: { schoolId: school.id },
        })
        await database!.gradeLevel.deleteMany({
          where: { schoolId: school.id },
        })
        await database!.academicYear.deleteMany({
          where: { schoolId: school.id },
        })
        await database!.schoolMembership.deleteMany({
          where: { schoolId: school.id },
        })
        await database!.student.delete({ where: { id: student.id } })
        await database!.guardian.deleteMany({
          where: { id: { in: [guardian.id, secondGuardian.id] } },
        })
        await database!.user.deleteMany({
          where: { id: { in: [admin.id, teacher.id] } },
        })
        await database!.user.deleteMany({ where: { email } })
        await database!.school.deleteMany({
          where: { id: { in: [school.id, otherSchool.id] } },
        })
        await database!.organization.delete({ where: { id: organization.id } })
      }
    })
  },
)
