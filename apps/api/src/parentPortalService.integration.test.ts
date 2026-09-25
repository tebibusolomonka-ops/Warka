import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import {
  createDatabaseClient,
  linkGuardianToStudent,
  linkGuardianUser,
  revokeGuardianRelationship,
  setParentPortalEnabled,
  verifyGuardianRelationship,
} from '@warka/database'
import {
  ParentPortalAccessError,
  prismaParentPortalService,
} from './parentPortalService.js'

const testUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = testUrl
  ? createDatabaseClient({ DATABASE_URL: testUrl })
  : null

afterAll(async () => {
  await database?.$disconnect()
})

describe.skipIf(!database)('parent portal identity in PostgreSQL', () => {
  it('returns only verified children at enabled schools to the linked guardian', async () => {
    const suffix = randomUUID()
    const organization = await database!.organization.create({
      data: { name: `Parent identity ${suffix}` },
    })
    const firstSchool = await database!.school.create({
      data: { organizationId: organization.id, name: 'First school' },
    })
    const secondSchool = await database!.school.create({
      data: { organizationId: organization.id, name: 'Second school' },
    })
    const admin = await database!.user.create({
      data: {
        email: `identity-admin-${suffix}@example.test`,
        displayName: 'Admin',
      },
    })
    const guardianUser = await database!.user.create({
      data: {
        email: `identity-parent-${suffix}@example.test`,
        displayName: 'Parent',
      },
    })
    const studentUser = await database!.user.create({
      data: {
        email: `identity-student-${suffix}@example.test`,
        displayName: 'Student user',
      },
    })
    const guardian = await database!.guardian.create({
      data: { name: 'Martha' },
    })
    const otherGuardian = await database!.guardian.create({
      data: { name: 'Other guardian' },
    })
    const children = await Promise.all(
      ['First', 'Second', 'Pending', 'Other'].map((name) =>
        database!.student.create({
          data: {
            studentReference: `IDENTITY-${name}-${suffix}`,
            givenName: name,
          },
        }),
      ),
    )
    const service = prismaParentPortalService(database!)
    try {
      await database!.schoolMembership.createMany({
        data: [firstSchool, secondSchool].map((school) => ({
          userId: admin.id,
          schoolId: school.id,
          role: 'administrator' as const,
        })),
      })
      const years = await Promise.all(
        [firstSchool, secondSchool].map((school) =>
          database!.academicYear.create({
            data: {
              schoolId: school.id,
              name: 'Year',
              startsOn: new Date('2026-01-01'),
              endsOn: new Date('2027-12-31'),
            },
          }),
        ),
      )
      const grades = await Promise.all(
        [firstSchool, secondSchool].map((school) =>
          database!.gradeLevel.create({
            data: { schoolId: school.id, name: 'Grade 1' },
          }),
        ),
      )
      await database!.enrollment.createMany({
        data: children.map((child, index) => ({
          studentId: child.id,
          schoolId: index === 1 ? secondSchool.id : firstSchool.id,
          academicYearId: index === 1 ? years[1].id : years[0].id,
          gradeLevelId: index === 1 ? grades[1].id : grades[0].id,
          status: 'approved' as const,
          approvedAt: new Date(),
          approvedById: admin.id,
        })),
      })
      await linkGuardianUser(database!, guardianUser.id, guardian.id)
      await database!.studentAccess.create({
        data: { userId: studentUser.id, studentId: children[3].id },
      })
      for (const child of children.slice(0, 3)) {
        await linkGuardianToStudent(database!, {
          studentId: child.id,
          guardianId: guardian.id,
          relationship: 'Parent',
        })
      }
      await linkGuardianToStudent(database!, {
        studentId: children[3].id,
        guardianId: otherGuardian.id,
        relationship: 'Parent',
      })
      await setParentPortalEnabled(database!, admin.id, firstSchool.id, true)
      await setParentPortalEnabled(database!, admin.id, secondSchool.id, true)
      await verifyGuardianRelationship(
        database!,
        admin.id,
        firstSchool.id,
        children[0].id,
        guardian.id,
      )
      await verifyGuardianRelationship(
        database!,
        admin.id,
        secondSchool.id,
        children[1].id,
        guardian.id,
      )
      expect(await service.identity(guardianUser.id)).toEqual({
        displayName: 'Martha',
      })
      expect(
        (await service.children(guardianUser.id)).map(
          (child) => child.studentReference,
        ),
      ).toEqual([children[0].studentReference, children[1].studentReference])
      await expect(service.children(admin.id)).rejects.toBeInstanceOf(
        ParentPortalAccessError,
      )
      await expect(service.children(studentUser.id)).rejects.toBeInstanceOf(
        ParentPortalAccessError,
      )
      await setParentPortalEnabled(database!, admin.id, secondSchool.id, false)
      expect(
        (await service.children(guardianUser.id)).map(
          (child) => child.studentReference,
        ),
      ).toEqual([children[0].studentReference])
      await revokeGuardianRelationship(
        database!,
        admin.id,
        firstSchool.id,
        children[0].id,
        guardian.id,
        'Review',
      )
      await expect(service.children(guardianUser.id)).rejects.toBeInstanceOf(
        ParentPortalAccessError,
      )
      await expect(service.identity(guardianUser.id)).rejects.toBeInstanceOf(
        ParentPortalAccessError,
      )
    } finally {
      await database!.schoolServiceAccess.deleteMany({
        where: { schoolId: { in: [firstSchool.id, secondSchool.id] } },
      })
      await database!.guardianAccess.deleteMany({
        where: { guardianId: guardian.id },
      })
      await database!.studentGuardian.deleteMany({
        where: { studentId: { in: children.map((child) => child.id) } },
      })
      await database!.studentAccess.deleteMany({
        where: { userId: studentUser.id },
      })
      await database!.enrollment.deleteMany({
        where: { studentId: { in: children.map((child) => child.id) } },
      })
      await database!.gradeLevel.deleteMany({
        where: { schoolId: { in: [firstSchool.id, secondSchool.id] } },
      })
      await database!.academicYear.deleteMany({
        where: { schoolId: { in: [firstSchool.id, secondSchool.id] } },
      })
      await database!.schoolMembership.deleteMany({
        where: { userId: admin.id },
      })
      await database!.student.deleteMany({
        where: { id: { in: children.map((child) => child.id) } },
      })
      await database!.guardian.deleteMany({
        where: { id: { in: [guardian.id, otherGuardian.id] } },
      })
      await database!.user.deleteMany({
        where: { id: { in: [admin.id, guardianUser.id, studentUser.id] } },
      })
      await database!.school.deleteMany({
        where: { id: { in: [firstSchool.id, secondSchool.id] } },
      })
      await database!.organization.delete({ where: { id: organization.id } })
    }
  })
})
