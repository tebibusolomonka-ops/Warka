import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import {
  createDatabaseClient,
  createImportJob,
  applyStudentImport,
  validateStudentImport,
} from './index.js'

const testUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = testUrl
  ? createDatabaseClient({ DATABASE_URL: testUrl })
  : null

afterAll(async () => {
  await database?.$disconnect()
})

describe.skipIf(!database)('student import validation in PostgreSQL', () => {
  it('resolves school structure, flags duplicates, and does not create students', async () => {
    const suffix = randomUUID()
    const givenName = 'Ada' + suffix.slice(0, 8)
    const organization = await database!.organization.create({
      data: { name: 'Student import ' + suffix },
    })
    const school = await database!.school.create({
      data: { organizationId: organization.id, name: 'Import target' },
    })
    const otherSchool = await database!.school.create({
      data: { organizationId: organization.id, name: 'Import other' },
    })
    const actor = await database!.user.create({
      data: {
        email: 'student-import-' + suffix + '@example.test',
        displayName: 'Student import registrar',
        schoolMemberships: {
          create: { schoolId: school.id, role: 'registrar' },
        },
      },
    })
    const year = await database!.academicYear.create({
      data: {
        schoolId: school.id,
        name: '2026/27',
        startsOn: new Date('2026-09-01'),
        endsOn: new Date('2027-06-30'),
      },
    })
    const grade = await database!.gradeLevel.create({
      data: { schoolId: school.id, name: 'Grade 1' },
    })
    const schoolClass = await database!.schoolClass.create({
      data: {
        schoolId: school.id,
        academicYearId: year.id,
        gradeLevelId: grade.id,
        name: 'A',
      },
    })
    const otherYear = await database!.academicYear.create({
      data: {
        schoolId: otherSchool.id,
        name: '2026/27',
        startsOn: new Date('2026-09-01'),
        endsOn: new Date('2027-06-30'),
      },
    })
    const otherGrade = await database!.gradeLevel.create({
      data: { schoolId: otherSchool.id, name: 'Grade 1' },
    })
    const otherClass = await database!.schoolClass.create({
      data: {
        schoolId: otherSchool.id,
        academicYearId: otherYear.id,
        gradeLevelId: otherGrade.id,
        name: 'A',
      },
    })
    const existing = await database!.student.create({
      data: {
        studentReference: 'WKA-' + suffix.replaceAll('-', '').slice(0, 20),
        givenName,
        familyName: 'Bora',
        dateOfBirth: new Date('2018-04-02'),
      },
    })
    await database!.enrollment.create({
      data: {
        studentId: existing.id,
        schoolId: school.id,
        academicYearId: year.id,
        gradeLevelId: grade.id,
        schoolClassId: schoolClass.id,
      },
    })
    const createdStudentIds: string[] = []
    const guardianName = 'Import guardian ' + suffix
    try {
      const job = await createImportJob(database!, actor.id, {
        schoolId: school.id,
      })
      const studentCount = await database!.student.count({
        where: { givenName },
      })
      const header =
        'givenName,familyName,dateOfBirth,academicYearId,gradeLevelId,schoolClassId'
      const row = `${givenName},Bora,2018-04-02,${year.id},${grade.id},${schoolClass.id}`
      const reviewed = await validateStudentImport(
        database!,
        actor.id,
        school.id,
        job.id,
        header + '\n' + row,
      )
      expect(reviewed.status).toBe('validated')
      expect(reviewed.issues).toMatchObject([
        { severity: 'warning', code: 'possibleDuplicate' },
      ])
      expect(reviewed.normalizedRows).toHaveLength(1)
      expect(await database!.student.count({ where: { givenName } })).toBe(
        studentCount,
      )

      const crossSchool = await validateStudentImport(
        database!,
        actor.id,
        school.id,
        job.id,
        header +
          '\n' +
          `Nina,Tola,2018-05-02,${year.id},${grade.id},${otherClass.id}`,
      )
      expect(crossSchool.status).toBe('invalid')
      expect(crossSchool.issues).toMatchObject([
        { severity: 'error', code: 'invalidClass' },
      ])
      const repeated = await validateStudentImport(
        database!,
        actor.id,
        school.id,
        job.id,
        header + '\n' + row + '\n' + row,
      )
      expect(repeated.status).toBe('invalid')
      expect(
        repeated.issues.some((item) => item.code === 'duplicateCsvRow'),
      ).toBe(true)
      await expect(
        applyStudentImport(database!, actor.id, school.id, job.id, true),
      ).rejects.toThrow('Only valid imports can be applied')
      await expect(
        applyStudentImport(database!, actor.id, otherSchool.id, job.id, true),
      ).rejects.toThrow('Import permission denied')

      const guardianHeader = header + ',guardianName,guardianRelationship'
      const secondName = 'Nina' + suffix.slice(0, 8)
      const ready = await validateStudentImport(
        database!,
        actor.id,
        school.id,
        job.id,
        guardianHeader +
          '\n' +
          row +
          ',' +
          guardianName +
          ',mother' +
          '\n' +
          `${secondName},Tola,2018-05-02,${year.id},${grade.id},${schoolClass.id},${guardianName},father`,
      )
      expect(ready.status).toBe('validated')
      await expect(
        applyStudentImport(database!, actor.id, school.id, job.id, false),
      ).rejects.toThrow('Import warnings require acknowledgement')
      const applied = await applyStudentImport(
        database!,
        actor.id,
        school.id,
        job.id,
        true,
      )
      createdStudentIds.push(...applied.created.map((item) => item.studentId))
      expect(applied.job.status).toBe('applied')
      expect(applied.created).toHaveLength(2)
      expect(
        new Set(applied.created.map((item) => item.studentReference)).size,
      ).toBe(2)
      expect(
        await database!.enrollment.count({
          where: { studentId: { in: createdStudentIds }, status: 'draft' },
        }),
      ).toBe(2)
      expect(
        await database!.studentGuardian.count({
          where: {
            studentId: { in: createdStudentIds },
            verificationStatus: 'pending',
          },
        }),
      ).toBe(2)
      expect(
        await database!.auditEvent.count({
          where: { action: 'studentImport.applied', resourceId: job.id },
        }),
      ).toBe(1)
      await expect(
        applyStudentImport(database!, actor.id, school.id, job.id, true),
      ).rejects.toThrow('Only valid imports can be applied')

      const staleClass = await database!.schoolClass.create({
        data: {
          schoolId: school.id,
          academicYearId: year.id,
          gradeLevelId: grade.id,
          name: 'B',
        },
      })
      const rollbackJob = await createImportJob(database!, actor.id, {
        schoolId: school.id,
      })
      const rollbackName = 'Rollback' + suffix.slice(0, 8)
      const rollbackCsv =
        header +
        '\n' +
        `${rollbackName},A,2018-06-01,${year.id},${grade.id},${schoolClass.id}` +
        '\n' +
        `${rollbackName}Other,B,2018-06-02,${year.id},${grade.id},${staleClass.id}`
      expect(
        (
          await validateStudentImport(
            database!,
            actor.id,
            school.id,
            rollbackJob.id,
            rollbackCsv,
          )
        ).status,
      ).toBe('validated')
      await database!.schoolClass.delete({ where: { id: staleClass.id } })
      await expect(
        applyStudentImport(
          database!,
          actor.id,
          school.id,
          rollbackJob.id,
          true,
        ),
      ).rejects.toThrow()
      expect(
        await database!.importJob.findUniqueOrThrow({
          where: { id: rollbackJob.id },
        }),
      ).toMatchObject({ status: 'validated', appliedAt: null })
      expect(
        await database!.student.count({ where: { givenName: rollbackName } }),
      ).toBe(0)
    } finally {
      await database!.auditEvent.deleteMany({
        where: { action: 'studentImport.applied', schoolId: school.id },
      })
      await database!.importJob.deleteMany({ where: { schoolId: school.id } })
      await database!.enrollment.deleteMany({
        where: { studentId: { in: [existing.id, ...createdStudentIds] } },
      })
      await database!.student.deleteMany({
        where: { id: { in: [existing.id, ...createdStudentIds] } },
      })
      await database!.guardian.deleteMany({ where: { name: guardianName } })
      await database!.schoolClass.deleteMany({
        where: { id: { in: [schoolClass.id, otherClass.id] } },
      })
      await database!.gradeLevel.deleteMany({
        where: { id: { in: [grade.id, otherGrade.id] } },
      })
      await database!.academicYear.deleteMany({
        where: { id: { in: [year.id, otherYear.id] } },
      })
      await database!.schoolMembership.deleteMany({
        where: { userId: actor.id },
      })
      await database!.user.delete({ where: { id: actor.id } })
      await database!.school.deleteMany({
        where: { id: { in: [school.id, otherSchool.id] } },
      })
      await database!.organization.delete({ where: { id: organization.id } })
    }
  })
})
