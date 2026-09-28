import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import {
  createClassTimetableEntry,
  createClassTimetableDraft,
  createDatabaseClient,
  publishClassTimetable,
} from './index.js'

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = url ? createDatabaseClient({ DATABASE_URL: url }) : null
afterAll(async () => database?.$disconnect())

describe.skipIf(!database)('class timetable entries in PostgreSQL', () => {
  it('binds a weekly slot to its exact class, subject, assignment and school', async () => {
    const suffix = randomUUID()
    const organization = await database!.organization.create({
      data: { name: `Timetable ${suffix}` },
    })
    const school = await database!.school.create({
      data: { organizationId: organization.id, name: 'Timetable school' },
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
    const subject = await database!.subject.create({
      data: { schoolId: school.id, name: 'Mathematics' },
    })
    const teacher = await database!.user.create({
      data: {
        email: `timetable-${suffix}@example.test`,
        displayName: 'Teacher',
      },
    })
    const assignment = await database!.teachingAssignment.create({
      data: {
        schoolId: school.id,
        academicYearId: year.id,
        schoolClassId: schoolClass.id,
        subjectId: subject.id,
        userId: teacher.id,
      },
    })
    const period = await database!.timetablePeriod.create({
      data: {
        schoolId: school.id,
        name: 'First',
        startTime: '08:00',
        endTime: '08:45',
        sortOrder: 1,
      },
    })
    const plan = await database!.classTimetable.create({
      data: {
        schoolId: school.id,
        academicYearId: year.id,
        schoolClassId: schoolClass.id,
      },
    })
    try {
      const entry = await createClassTimetableEntry(database!, {
        timetableId: plan.id,
        schoolId: school.id,
        academicYearId: year.id,
        schoolClassId: schoolClass.id,
        subjectId: subject.id,
        teachingAssignmentId: assignment.id,
        timetablePeriodId: period.id,
        weekday: 1,
      })
      expect(entry.weekday).toBe(1)
      await expect(
        createClassTimetableEntry(database!, {
          timetableId: plan.id,
          schoolId: school.id,
          academicYearId: year.id,
          schoolClassId: schoolClass.id,
          subjectId: subject.id,
          teachingAssignmentId: assignment.id,
          timetablePeriodId: period.id,
          weekday: 1,
        }),
      ).rejects.toThrow('CLASS_COLLISION')
      const published = await publishClassTimetable(
        database!,
        teacher.id,
        plan.id,
      )
      expect(published.status).toBe('published')
      const replacement = await createClassTimetableDraft(database!, {
        schoolId: school.id,
        academicYearId: year.id,
        schoolClassId: schoolClass.id,
      })
      await createClassTimetableEntry(database!, {
        timetableId: replacement.id,
        schoolId: school.id,
        academicYearId: year.id,
        schoolClassId: schoolClass.id,
        subjectId: subject.id,
        teachingAssignmentId: assignment.id,
        timetablePeriodId: period.id,
        weekday: 1,
      })
      await publishClassTimetable(database!, teacher.id, replacement.id)
      expect(
        (
          await database!.classTimetable.findUniqueOrThrow({
            where: { id: plan.id },
          })
        ).status,
      ).toBe('archived')
      expect(
        await database!.classTimetableEntry.count({
          where: { timetableId: plan.id },
        }),
      ).toBe(1)
    } finally {
      await database!.classTimetableEntry.deleteMany({
        where: { schoolId: school.id },
      })
      await database!.classTimetable.deleteMany({
        where: { schoolId: school.id },
      })
      await database!.auditEvent.deleteMany({
        where: { actorUserId: teacher.id },
      })
      await database!.timetablePeriod.delete({ where: { id: period.id } })
      await database!.teachingAssignment.delete({
        where: { id: assignment.id },
      })
      await database!.user.delete({ where: { id: teacher.id } })
      await database!.subject.delete({ where: { id: subject.id } })
      await database!.schoolClass.delete({ where: { id: schoolClass.id } })
      await database!.gradeLevel.delete({ where: { id: grade.id } })
      await database!.academicYear.delete({ where: { id: year.id } })
      await database!.school.delete({ where: { id: school.id } })
      await database!.organization.delete({ where: { id: organization.id } })
    }
  })
})
