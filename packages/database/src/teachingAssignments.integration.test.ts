import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { createDatabaseClient } from './index.js'
import { createOrganization } from './organizations.js'
import { createSchool } from './schools.js'
import { createUser } from './users.js'
import { assignUserToSchool } from './schoolMemberships.js'
import { createAcademicYear } from './academicYears.js'
import { createGradeLevel } from './gradeLevels.js'
import { createSchoolClass } from './schoolClasses.js'
import { createSubject } from './subjects.js'
import {
  assignTeacher,
  DuplicateTeachingAssignmentError,
  InvalidTeachingAssignmentError,
  listClassSubjectAssignments,
  listTeacherAssignments,
  mayManageClassSubject,
  removeTeachingAssignment,
} from './teachingAssignments.js'

const testUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = testUrl
  ? createDatabaseClient({ DATABASE_URL: testUrl })
  : null

afterAll(async () => {
  await database?.$disconnect()
})

describe.skipIf(!database)('teaching assignments in PostgreSQL', () => {
  it('enforces teacher membership, uniqueness, and school and class context', async () => {
    const organization = await createOrganization(database!, {
      name: 'Teaching assignment test',
    })
    const firstSchool = await createSchool(database!, {
      organizationId: organization.id,
      name: 'First assignment school',
    })
    const otherSchool = await createSchool(database!, {
      organizationId: organization.id,
      name: 'Other assignment school',
    })
    const schools = [firstSchool.id, otherSchool.id]
    const firstYear = await createAcademicYear(database!, {
      schoolId: firstSchool.id,
      name: 'Assignment year',
      startsOn: '2026-09-11',
      endsOn: '2027-09-10',
    })
    const otherYear = await createAcademicYear(database!, {
      schoolId: otherSchool.id,
      name: 'Other assignment year',
      startsOn: '2026-09-11',
      endsOn: '2027-09-10',
    })
    const firstGrade = await createGradeLevel(database!, {
      schoolId: firstSchool.id,
      name: 'Grade 1',
    })
    const otherGrade = await createGradeLevel(database!, {
      schoolId: otherSchool.id,
      name: 'Grade 1',
    })
    const schoolClass = await createSchoolClass(database!, {
      schoolId: firstSchool.id,
      academicYearId: firstYear.id,
      gradeLevelId: firstGrade.id,
      name: 'A',
    })
    const otherClass = await createSchoolClass(database!, {
      schoolId: otherSchool.id,
      academicYearId: otherYear.id,
      gradeLevelId: otherGrade.id,
      name: 'A',
    })
    const subject = await createSubject(database!, {
      schoolId: firstSchool.id,
      name: 'Mathematics',
    })
    const secondSubject = await createSubject(database!, {
      schoolId: firstSchool.id,
      name: 'Reading',
    })
    const otherSubject = await createSubject(database!, {
      schoolId: otherSchool.id,
      name: 'Mathematics',
    })
    const teacher = await createUser(database!, {
      email: randomUUID() + '@example.test',
      displayName: 'Teacher One',
    })
    const secondTeacher = await createUser(database!, {
      email: randomUUID() + '@example.test',
      displayName: 'Teacher Two',
    })
    const registrar = await createUser(database!, {
      email: randomUUID() + '@example.test',
      displayName: 'Registrar',
    })
    const otherTeacher = await createUser(database!, {
      email: randomUUID() + '@example.test',
      displayName: 'Other teacher',
    })
    const users = [teacher.id, secondTeacher.id, registrar.id, otherTeacher.id]
    await assignUserToSchool(database!, {
      userId: teacher.id,
      schoolId: firstSchool.id,
      role: 'teacher',
    })
    await assignUserToSchool(database!, {
      userId: secondTeacher.id,
      schoolId: firstSchool.id,
      role: 'teacher',
    })
    await assignUserToSchool(database!, {
      userId: registrar.id,
      schoolId: firstSchool.id,
      role: 'registrar',
    })
    await assignUserToSchool(database!, {
      userId: otherTeacher.id,
      schoolId: otherSchool.id,
      role: 'teacher',
    })
    try {
      const input = {
        schoolId: firstSchool.id,
        userId: teacher.id,
        academicYearId: firstYear.id,
        schoolClassId: schoolClass.id,
        subjectId: subject.id,
      }
      const assignment = await assignTeacher(database!, input)
      expect(
        await mayManageClassSubject(
          database!,
          teacher.id,
          firstSchool.id,
          firstYear.id,
          schoolClass.id,
          subject.id,
        ),
      ).toBe(true)
      expect(
        await mayManageClassSubject(
          database!,
          teacher.id,
          otherSchool.id,
          otherYear.id,
          otherClass.id,
          otherSubject.id,
        ),
      ).toBe(false)
      await expect(assignTeacher(database!, input)).rejects.toBeInstanceOf(
        DuplicateTeachingAssignmentError,
      )
      await expect(
        assignTeacher(database!, { ...input, userId: registrar.id }),
      ).rejects.toBeInstanceOf(InvalidTeachingAssignmentError)
      await expect(
        assignTeacher(database!, { ...input, userId: otherTeacher.id }),
      ).rejects.toBeInstanceOf(InvalidTeachingAssignmentError)
      await expect(
        assignTeacher(database!, { ...input, academicYearId: otherYear.id }),
      ).rejects.toBeInstanceOf(InvalidTeachingAssignmentError)
      await expect(
        assignTeacher(database!, { ...input, schoolClassId: otherClass.id }),
      ).rejects.toBeInstanceOf(InvalidTeachingAssignmentError)
      await expect(
        assignTeacher(database!, { ...input, subjectId: otherSubject.id }),
      ).rejects.toBeInstanceOf(InvalidTeachingAssignmentError)
      await assignTeacher(database!, { ...input, subjectId: secondSubject.id })
      await assignTeacher(database!, { ...input, userId: secondTeacher.id })
      expect(
        await listTeacherAssignments(database!, firstSchool.id, teacher.id),
      ).toHaveLength(2)
      expect(
        await listTeacherAssignments(database!, otherSchool.id, teacher.id),
      ).toHaveLength(0)
      expect(
        await listClassSubjectAssignments(
          database!,
          firstSchool.id,
          firstYear.id,
          schoolClass.id,
          subject.id,
        ),
      ).toHaveLength(2)
      expect(
        await removeTeachingAssignment(
          database!,
          otherSchool.id,
          assignment.id,
        ),
      ).toBe(false)
      expect(
        await removeTeachingAssignment(
          database!,
          firstSchool.id,
          assignment.id,
        ),
      ).toBe(true)
      expect(
        await mayManageClassSubject(
          database!,
          teacher.id,
          firstSchool.id,
          firstYear.id,
          schoolClass.id,
          subject.id,
        ),
      ).toBe(false)
      await database!.schoolMembership.update({
        where: {
          userId_schoolId: { userId: teacher.id, schoolId: firstSchool.id },
        },
        data: { role: 'registrar' },
      })
      expect(
        await mayManageClassSubject(
          database!,
          teacher.id,
          firstSchool.id,
          firstYear.id,
          schoolClass.id,
          secondSubject.id,
        ),
      ).toBe(false)
    } finally {
      await database!.teachingAssignment.deleteMany({
        where: { schoolId: { in: schools } },
      })
      await database!.schoolMembership.deleteMany({
        where: { schoolId: { in: schools } },
      })
      await database!.subject.deleteMany({
        where: { schoolId: { in: schools } },
      })
      await database!.schoolClass.deleteMany({
        where: { schoolId: { in: schools } },
      })
      await database!.gradeLevel.deleteMany({
        where: { schoolId: { in: schools } },
      })
      await database!.academicYear.deleteMany({
        where: { schoolId: { in: schools } },
      })
      await database!.user.deleteMany({ where: { id: { in: users } } })
      await database!.school.deleteMany({
        where: { organizationId: organization.id },
      })
      await database!.organization.delete({ where: { id: organization.id } })
    }
  })
})
