import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import {
  createDatabaseClient,
  linkGuardianToStudent,
  linkGuardianUser,
  setParentPortalEnabled,
  verifyGuardianRelationship,
} from '@warka/database'
import {
  FamilyConversationAccessError,
  FamilyConversationStateError,
  prismaFamilyConversationService,
} from './familyConversationService.js'

const testUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = testUrl
  ? createDatabaseClient({ DATABASE_URL: testUrl })
  : null

afterAll(async () => {
  await database?.$disconnect()
})

describe.skipIf(!database)('family conversations in PostgreSQL', () => {
  it('routes guardian messages to the current teacher or school office with isolation', async () => {
    const suffix = randomUUID()
    const organization = await database!.organization.create({
      data: { name: `Family ${suffix}` },
    })
    const school = await database!.school.create({
      data: { organizationId: organization.id, name: 'Family school' },
    })
    const otherSchool = await database!.school.create({
      data: { organizationId: organization.id, name: 'Other school' },
    })
    const createUser = (label: string) =>
      database!.user.create({
        data: { email: `${label}-${suffix}@example.test`, displayName: label },
      })
    const admin = await createUser('admin')
    const otherAdmin = await createUser('otherAdmin')
    const teacher = await createUser('teacher')
    const unrelatedTeacher = await createUser('unrelatedTeacher')
    const parent = await createUser('parent')
    const otherParent = await createUser('otherParent')
    const guardian = await database!.guardian.create({
      data: { name: 'Guardian' },
    })
    const otherGuardian = await database!.guardian.create({
      data: { name: 'Other guardian' },
    })
    const student = await database!.student.create({
      data: { studentReference: `FAMILY-${suffix}`, givenName: 'Child' },
    })
    const otherStudent = await database!.student.create({
      data: { studentReference: `OTHER-${suffix}`, givenName: 'Other child' },
    })
    const service = prismaFamilyConversationService(database!)
    try {
      await database!.schoolMembership.createMany({
        data: [
          { userId: admin.id, schoolId: school.id, role: 'administrator' },
          {
            userId: otherAdmin.id,
            schoolId: otherSchool.id,
            role: 'administrator',
          },
          { userId: teacher.id, schoolId: school.id, role: 'teacher' },
          { userId: unrelatedTeacher.id, schoolId: school.id, role: 'teacher' },
        ],
      })
      const year = await database!.academicYear.create({
        data: {
          schoolId: school.id,
          name: 'Year',
          startsOn: new Date('2026-01-01'),
          endsOn: new Date('2027-12-31'),
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
          name: 'A',
        },
      })
      const subject = await database!.subject.create({
        data: { schoolId: school.id, name: 'Math' },
      })
      await database!.teachingAssignment.create({
        data: {
          schoolId: school.id,
          academicYearId: year.id,
          schoolClassId: schoolClass.id,
          subjectId: subject.id,
          userId: teacher.id,
        },
      })
      await database!.enrollment.createMany({
        data: [student, otherStudent].map((child) => ({
          studentId: child.id,
          schoolId: school.id,
          academicYearId: year.id,
          gradeLevelId: grade.id,
          schoolClassId: schoolClass.id,
          status: 'approved' as const,
          approvedAt: new Date(),
          approvedById: admin.id,
        })),
      })
      await linkGuardianToStudent(database!, {
        studentId: student.id,
        guardianId: guardian.id,
        relationship: 'Parent',
      })
      await linkGuardianToStudent(database!, {
        studentId: otherStudent.id,
        guardianId: otherGuardian.id,
        relationship: 'Parent',
      })
      await linkGuardianUser(database!, parent.id, guardian.id)
      await linkGuardianUser(database!, otherParent.id, otherGuardian.id)
      await setParentPortalEnabled(database!, admin.id, school.id, true)
      await verifyGuardianRelationship(
        database!,
        admin.id,
        school.id,
        student.id,
        guardian.id,
      )
      await verifyGuardianRelationship(
        database!,
        admin.id,
        school.id,
        otherStudent.id,
        otherGuardian.id,
      )
      expect(
        (
          await service.teacherContacts(parent.id, student.studentReference)
        ).map((item) => item.id),
      ).toEqual([teacher.id])
      await expect(
        service.create(parent.id, {
          studentReference: student.studentReference,
          route: 'teacher',
          teacherUserId: unrelatedTeacher.id,
          body: 'Question',
        }),
      ).rejects.toBeInstanceOf(FamilyConversationAccessError)
      await expect(
        service.create(parent.id, {
          studentReference: student.studentReference,
          route: 'schoolOffice',
          body: '   ',
        }),
      ).rejects.toThrow()
      const office = await service.create(parent.id, {
        studentReference: student.studentReference,
        route: 'schoolOffice',
        body: 'School record question',
      })
      const teacherThread = await service.create(parent.id, {
        studentReference: student.studentReference,
        route: 'teacher',
        teacherUserId: teacher.id,
        body: 'Math question',
      })
      expect(
        (await service.listGuardian(parent.id)).map((item) => item.id),
      ).toEqual(expect.arrayContaining([office.id, teacherThread.id]))
      expect(
        (await service.listSchool(admin.id, school.id)).map((item) => item.id),
      ).toContain(office.id)
      expect(
        (await service.listSchool(teacher.id, school.id)).map(
          (item) => item.id,
        ),
      ).toContain(teacherThread.id)
      await expect(
        service.read(otherParent.id, office.id),
      ).rejects.toBeInstanceOf(FamilyConversationAccessError)
      await expect(
        service.read(unrelatedTeacher.id, teacherThread.id),
      ).rejects.toBeInstanceOf(FamilyConversationAccessError)
      await expect(
        service.listSchool(otherAdmin.id, school.id),
      ).rejects.toBeInstanceOf(FamilyConversationAccessError)
      await expect(
        service.escalate(parent.id, office.id),
      ).rejects.toBeInstanceOf(FamilyConversationAccessError)
      const escalated = await service.escalate(teacher.id, teacherThread.id)
      expect(escalated.escalatedById).toBe(teacher.id)
      expect(escalated.escalatedAt).toBeInstanceOf(Date)
      expect(
        (await service.listSchool(admin.id, school.id)).map((item) => item.id),
      ).toContain(teacherThread.id)
      await service.send(
        admin.id,
        teacherThread.id,
        'Leadership will review this.',
      )
      await service.send(admin.id, office.id, 'We will review it.')
      expect((await service.read(parent.id, office.id)).messages).toHaveLength(
        2,
      )
      expect(
        (await service.read(parent.id, office.id, 1, 1)).messages,
      ).toHaveLength(1)
      await database!.teachingAssignment.deleteMany({
        where: { userId: teacher.id, schoolId: school.id },
      })
      await expect(
        service.create(parent.id, {
          studentReference: student.studentReference,
          route: 'teacher',
          teacherUserId: teacher.id,
          body: 'New question',
        }),
      ).rejects.toBeInstanceOf(FamilyConversationAccessError)
      await expect(
        service.send(parent.id, teacherThread.id, 'After assignment'),
      ).rejects.toBeInstanceOf(FamilyConversationAccessError)
      expect(
        (await service.read(teacher.id, teacherThread.id)).messages.length,
      ).toBeGreaterThan(0)
      await service.close(admin.id, office.id)
      await expect(
        service.send(parent.id, office.id, 'Another message'),
      ).rejects.toBeInstanceOf(FamilyConversationStateError)
    } finally {
      await database!.familyMessage.deleteMany({
        where: { conversation: { schoolId: school.id } },
      })
      await database!.familyConversation.deleteMany({
        where: { schoolId: school.id },
      })
      await database!.teachingAssignment.deleteMany({
        where: { schoolId: school.id },
      })
      await database!.schoolServiceAccess.deleteMany({
        where: { schoolId: school.id },
      })
      await database!.guardianAccess.deleteMany({
        where: { guardianId: { in: [guardian.id, otherGuardian.id] } },
      })
      await database!.studentGuardian.deleteMany({
        where: { studentId: { in: [student.id, otherStudent.id] } },
      })
      await database!.enrollment.deleteMany({ where: { schoolId: school.id } })
      await database!.subject.deleteMany({ where: { schoolId: school.id } })
      await database!.schoolClass.deleteMany({ where: { schoolId: school.id } })
      await database!.gradeLevel.deleteMany({ where: { schoolId: school.id } })
      await database!.academicYear.deleteMany({
        where: { schoolId: school.id },
      })
      await database!.schoolMembership.deleteMany({
        where: { schoolId: { in: [school.id, otherSchool.id] } },
      })
      await database!.student.deleteMany({
        where: { id: { in: [student.id, otherStudent.id] } },
      })
      await database!.guardian.deleteMany({
        where: { id: { in: [guardian.id, otherGuardian.id] } },
      })
      await database!.user.deleteMany({
        where: {
          id: {
            in: [
              admin.id,
              otherAdmin.id,
              teacher.id,
              unrelatedTeacher.id,
              parent.id,
              otherParent.id,
            ],
          },
        },
      })
      await database!.school.deleteMany({
        where: { id: { in: [school.id, otherSchool.id] } },
      })
      await database!.organization.delete({ where: { id: organization.id } })
    }
  })
})
