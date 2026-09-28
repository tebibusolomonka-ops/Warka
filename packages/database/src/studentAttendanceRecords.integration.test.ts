import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { createDatabaseClient, createStudentAttendanceRecord } from './index.js'

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = url ? createDatabaseClient({ DATABASE_URL: url }) : null
afterAll(async () => database?.$disconnect())

describe.skipIf(!database)('student attendance records in PostgreSQL', () => {
  it('records one explicit status only for an approved class enrollment', async () => {
    const suffix = randomUUID()
    const organization = await database!.organization.create({
      data: { name: `Attendance record ${suffix}` },
    })
    const school = await database!.school.create({
      data: { organizationId: organization.id, name: 'Record school' },
    })
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
    const schoolClass = await database!.schoolClass.create({
      data: {
        schoolId: school.id,
        academicYearId: year.id,
        gradeLevelId: grade.id,
        name: 'A',
      },
    })
    const actor = await database!.user.create({
      data: { email: `record-${suffix}@example.test`, displayName: 'Recorder' },
    })
    await database!.schoolMembership.create({
      data: {
        userId: actor.id,
        schoolId: school.id,
        role: 'administrator',
        startsAt: new Date('2026-01-01'),
      },
    })
    const student = await database!.student.create({
      data: { studentReference: `AT-${suffix}`, givenName: 'Synthetic' },
    })
    const enrollment = await database!.enrollment.create({
      data: {
        studentId: student.id,
        schoolId: school.id,
        academicYearId: year.id,
        gradeLevelId: grade.id,
        schoolClassId: schoolClass.id,
        status: 'approved',
      },
    })
    const session = await database!.attendanceSession.create({
      data: {
        schoolId: school.id,
        academicYearId: year.id,
        schoolClassId: schoolClass.id,
        date: new Date('2026-09-28'),
        createdById: actor.id,
      },
    })
    try {
      const input = {
        sessionId: session.id,
        studentId: student.id,
        enrollmentId: enrollment.id,
        status: 'present' as const,
      }
      const record = await createStudentAttendanceRecord(
        database!,
        actor.id,
        input,
      )
      expect(record.status).toBe('present')
      await expect(
        createStudentAttendanceRecord(database!, actor.id, input),
      ).rejects.toThrow('already exists')
      await expect(
        createStudentAttendanceRecord(database!, actor.id, {
          ...input,
          enrollmentId: randomUUID(),
        }),
      ).rejects.toThrow('Eligible enrollment')
    } finally {
      await database!.studentAttendanceRecord.deleteMany({
        where: { sessionId: session.id },
      })
      await database!.attendanceSession.delete({ where: { id: session.id } })
      await database!.enrollment.delete({ where: { id: enrollment.id } })
      await database!.student.delete({ where: { id: student.id } })
      await database!.schoolMembership.delete({
        where: { userId_schoolId: { userId: actor.id, schoolId: school.id } },
      })
      await database!.user.delete({ where: { id: actor.id } })
      await database!.schoolClass.delete({ where: { id: schoolClass.id } })
      await database!.gradeLevel.delete({ where: { id: grade.id } })
      await database!.academicYear.delete({ where: { id: year.id } })
      await database!.school.delete({ where: { id: school.id } })
      await database!.organization.delete({ where: { id: organization.id } })
    }
  })
})
