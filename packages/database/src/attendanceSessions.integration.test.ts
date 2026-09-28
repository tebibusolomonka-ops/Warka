import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { createAttendanceSession, createDatabaseClient } from './index.js'

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = url ? createDatabaseClient({ DATABASE_URL: url }) : null
afterAll(async () => database?.$disconnect())

describe.skipIf(!database)('attendance sessions in PostgreSQL', () => {
  it('opens only one explicit class/day session inside the year and outside closures', async () => {
    const suffix = randomUUID()
    const organization = await database!.organization.create({
      data: { name: `Attendance ${suffix}` },
    })
    const school = await database!.school.create({
      data: { organizationId: organization.id, name: 'Attendance school' },
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
      data: {
        email: `attendance-${suffix}@example.test`,
        displayName: 'Attendance administrator',
      },
    })
    await database!.schoolMembership.create({
      data: {
        userId: actor.id,
        schoolId: school.id,
        role: 'administrator',
        startsAt: new Date('2026-01-01'),
      },
    })
    await database!.schoolCalendarDay.create({
      data: {
        schoolId: school.id,
        academicYearId: year.id,
        date: new Date('2026-09-29'),
        dayType: 'closure',
      },
    })
    try {
      const input = {
        schoolId: school.id,
        academicYearId: year.id,
        schoolClassId: schoolClass.id,
        date: '2026-09-28',
      }
      const session = await createAttendanceSession(database!, actor.id, input)
      expect(session.status).toBe('open')
      await expect(
        createAttendanceSession(database!, actor.id, input),
      ).rejects.toThrow('conflicts')
      await expect(
        createAttendanceSession(database!, actor.id, {
          ...input,
          date: '2026-09-29',
        }),
      ).rejects.toThrow('closed')
      await expect(
        createAttendanceSession(database!, actor.id, {
          ...input,
          date: '2027-01-01',
        }),
      ).rejects.toThrow('outside')
    } finally {
      await database!.attendanceSession.deleteMany({
        where: { schoolId: school.id },
      })
      await database!.schoolCalendarDay.deleteMany({
        where: { schoolId: school.id },
      })
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
