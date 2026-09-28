import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { createDatabaseClient } from './index.js'
import { checkEnrollmentDataQuality } from './enrollmentDataQuality.js'

const testUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = testUrl
  ? createDatabaseClient({ DATABASE_URL: testUrl })
  : null
afterAll(async () => database?.$disconnect())

describe.skipIf(!database)('enrollment quality in PostgreSQL', () => {
  it('reports an approved enrollment without a class and never mutates its lifecycle', async () => {
    const db = database!
    const organization = await db.organization.create({
      data: { name: `Enrollment quality ${randomUUID()}` },
    })
    const school = await db.school.create({
      data: { organizationId: organization.id, name: 'Quality school' },
    })
    const student = await db.student.create({
      data: { studentReference: `WKA-${randomUUID()}`, givenName: 'Hana' },
    })
    try {
      const year = await db.academicYear.create({
        data: {
          schoolId: school.id,
          name: 'Current',
          startsOn: new Date('2026-01-01'),
          endsOn: new Date('2026-12-31'),
        },
      })
      const grade = await db.gradeLevel.create({
        data: { schoolId: school.id, name: 'Grade 4' },
      })
      const enrollment = await db.enrollment.create({
        data: {
          schoolId: school.id,
          studentId: student.id,
          academicYearId: year.id,
          gradeLevelId: grade.id,
          status: 'approved',
          approvedAt: new Date(),
        },
      })
      const findings = await checkEnrollmentDataQuality(db, school.id)
      expect(findings.map((finding) => finding.code)).toContain(
        'ENROLLMENT_APPROVED_CLASS_MISSING',
      )
      expect(
        (
          await db.enrollment.findUniqueOrThrow({
            where: { id: enrollment.id },
          })
        ).status,
      ).toBe('approved')
      expect(
        findings.some((finding) => /dropout|re.enrollment/i.test(finding.code)),
      ).toBe(false)
    } finally {
      await db.enrollment.deleteMany({ where: { schoolId: school.id } })
      await db.gradeLevel.deleteMany({ where: { schoolId: school.id } })
      await db.academicYear.deleteMany({ where: { schoolId: school.id } })
      await db.student.delete({ where: { id: student.id } })
      await db.school.delete({ where: { id: school.id } })
      await db.organization.delete({ where: { id: organization.id } })
    }
  })
})
