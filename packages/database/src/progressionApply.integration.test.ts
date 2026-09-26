import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { createDatabaseClient } from './index.js'
import {
  createProgressionPlan,
  ProgressionPlanStateError,
} from './progressionPlans.js'
import {
  updateProgressionEntry,
  markProgressionPlanReviewed,
  ProgressionValidationError,
} from './progressionValidation.js'
import { applyProgressionPlan } from './progressionApply.js'

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = url ? createDatabaseClient({ DATABASE_URL: url }) : null
afterAll(async () => {
  await database?.$disconnect()
})

describe.skipIf(!database)('progression application in PostgreSQL', () => {
  it('reuses students, preserves source enrollments, creates draft targets, and cannot apply twice', async () => {
    const suffix = randomUUID()
    const organization = await database!.organization.create({
      data: { name: `Progression ${suffix}` },
    })
    const school = await database!.school.create({
      data: {
        organizationId: organization.id,
        name: `Progression School ${suffix}`,
      },
    })
    const actor = await database!.user.create({
      data: {
        email: `progression-${suffix}@example.test`,
        displayName: 'Progression Administrator',
        schoolMemberships: {
          create: { schoolId: school.id, role: 'administrator' },
        },
      },
    })
    try {
      const sourceYear = await database!.academicYear.create({
        data: {
          schoolId: school.id,
          name: 'Source',
          startsOn: new Date('2025-01-01'),
          endsOn: new Date('2025-12-31'),
        },
      })
      const targetYear = await database!.academicYear.create({
        data: {
          schoolId: school.id,
          name: 'Target',
          startsOn: new Date('2026-01-01'),
          endsOn: new Date('2026-12-31'),
        },
      })
      const sourceGrade = await database!.gradeLevel.create({
        data: { schoolId: school.id, name: 'Grade 1' },
      })
      const targetGrade = await database!.gradeLevel.create({
        data: { schoolId: school.id, name: 'Grade 2' },
      })
      const targetClass = await database!.schoolClass.create({
        data: {
          schoolId: school.id,
          academicYearId: targetYear.id,
          gradeLevelId: targetGrade.id,
          name: 'Class A',
        },
      })
      const student = await database!.student.create({
        data: { givenName: 'Synthetic', studentReference: `PROG-${suffix}` },
      })
      const source = await database!.enrollment.create({
        data: {
          schoolId: school.id,
          studentId: student.id,
          academicYearId: sourceYear.id,
          gradeLevelId: sourceGrade.id,
          status: 'approved',
          approvedAt: new Date(),
          approvedById: actor.id,
        },
      })
      const plan = await createProgressionPlan(database!, actor.id, {
        schoolId: school.id,
        sourceAcademicYearId: sourceYear.id,
        targetAcademicYearId: targetYear.id,
      })
      expect(plan.entries).toHaveLength(1)
      await expect(
        markProgressionPlanReviewed(database!, actor.id, school.id, plan.id),
      ).rejects.toBeInstanceOf(ProgressionValidationError)
      await updateProgressionEntry(
        database!,
        actor.id,
        school.id,
        plan.id,
        plan.entries[0]!.id,
        {
          action: 'promote',
          targetGradeLevelId: targetGrade.id,
          targetSchoolClassId: targetClass.id,
        },
      )
      await markProgressionPlanReviewed(database!, actor.id, school.id, plan.id)
      const result = await applyProgressionPlan(
        database!,
        actor.id,
        school.id,
        plan.id,
      )
      expect(result).toMatchObject({
        newEnrollments: 1,
        promotions: 1,
        sourceEnrollmentsPreserved: 1,
      })
      const enrollments = await database!.enrollment.findMany({
        where: { studentId: student.id, schoolId: school.id },
        orderBy: { createdAt: 'asc' },
      })
      expect(enrollments).toHaveLength(2)
      expect(
        enrollments.find((item) => item.id === source.id)?.academicYearId,
      ).toBe(sourceYear.id)
      const target = enrollments.find(
        (item) => item.academicYearId === targetYear.id,
      )
      expect(target).toMatchObject({
        studentId: student.id,
        status: 'draft',
        gradeLevelId: targetGrade.id,
        schoolClassId: targetClass.id,
      })
      expect(await database!.student.count({ where: { id: student.id } })).toBe(
        1,
      )
      expect(
        await database!.enrollmentHistoryEvent.count({
          where: { enrollmentId: target!.id, eventType: 'promoted' },
        }),
      ).toBe(1)
      await expect(
        applyProgressionPlan(database!, actor.id, school.id, plan.id),
      ).rejects.toBeInstanceOf(ProgressionPlanStateError)
    } finally {
      await database!.auditEvent.deleteMany({ where: { schoolId: school.id } })
      await database!.progressionPlan.deleteMany({
        where: { schoolId: school.id },
      })
      await database!.enrollment.deleteMany({ where: { schoolId: school.id } })
      await database!.schoolClass.deleteMany({ where: { schoolId: school.id } })
      await database!.gradeLevel.deleteMany({ where: { schoolId: school.id } })
      await database!.academicYear.deleteMany({
        where: { schoolId: school.id },
      })
      await database!.schoolMembership.deleteMany({
        where: { schoolId: school.id },
      })
      await database!.student.deleteMany({
        where: { studentReference: `PROG-${suffix}` },
      })
      await database!.user.delete({ where: { id: actor.id } })
      await database!.school.delete({ where: { id: school.id } })
      await database!.organization.delete({ where: { id: organization.id } })
    }
  })
})
