import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import {
  createDatabaseClient,
  createDocumentRequest,
  listSchoolDocumentRequests,
  listStudentDocumentRequests,
} from './index.js'

const testUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = testUrl
  ? createDatabaseClient({ DATABASE_URL: testUrl })
  : null
afterAll(async () => {
  await database?.$disconnect()
})
describe.skipIf(!database)('document requests in PostgreSQL', () => {
  it('requires an enrolled student and separates student, guardian, and school scopes', async () => {
    const suffix = randomUUID()
    const organization = await database!.organization.create({
      data: { name: `Request organization ${suffix}` },
    })
    const school = await database!.school.create({
      data: { organizationId: organization.id, name: 'Request school' },
    })
    const year = await database!.academicYear.create({
      data: {
        schoolId: school.id,
        name: 'Request year',
        startsOn: new Date('2026-01-01'),
        endsOn: new Date('2026-12-31'),
      },
    })
    const grade = await database!.gradeLevel.create({
      data: { schoolId: school.id, name: 'Request grade' },
    })
    const student = await database!.student.create({
      data: { studentReference: `REQUEST-${suffix}`, givenName: 'Synthetic' },
    })
    const learner = await database!.user.create({
      data: {
        email: `request-student-${suffix}@example.test`,
        displayName: 'Learner',
        studentAccess: { create: { studentId: student.id } },
      },
    })
    const guardian = await database!.user.create({
      data: {
        email: `request-guardian-${suffix}@example.test`,
        displayName: 'Guardian',
      },
    })
    const registrar = await database!.user.create({
      data: {
        email: `request-registrar-${suffix}@example.test`,
        displayName: 'Registrar',
        schoolMemberships: {
          create: { schoolId: school.id, role: 'registrar' },
        },
      },
    })
    await database!.enrollment.create({
      data: {
        schoolId: school.id,
        studentId: student.id,
        academicYearId: year.id,
        gradeLevelId: grade.id,
        status: 'approved',
        approvedAt: new Date(),
        approvedById: registrar.id,
      },
    })
    try {
      const request = await createDocumentRequest(database!, learner.id, {
        schoolId: school.id,
        studentId: student.id,
        academicYearId: year.id,
        documentType: 'transcript',
      })
      expect(request.status).toBe('requested')
      expect(
        (await listStudentDocumentRequests(database!, learner.id)).map(
          (item) => item.id,
        ),
      ).toContain(request.id)
      expect(
        (
          await listSchoolDocumentRequests(database!, registrar.id, school.id)
        ).map((item) => item.id),
      ).toContain(request.id)
      await expect(
        listStudentDocumentRequests(database!, guardian.id),
      ).rejects.toThrow('permission denied')
      await expect(
        createDocumentRequest(database!, guardian.id, {
          schoolId: school.id,
          studentId: student.id,
          academicYearId: year.id,
          documentType: 'reportCard',
        }),
      ).rejects.toThrow('permission denied')
    } finally {
      await database!.documentRequest.deleteMany({
        where: { schoolId: school.id },
      })
      await database!.enrollment.deleteMany({ where: { schoolId: school.id } })
      await database!.studentAccess.deleteMany({
        where: { studentId: student.id },
      })
      await database!.schoolMembership.deleteMany({
        where: { schoolId: school.id },
      })
      await database!.user.deleteMany({
        where: { id: { in: [learner.id, guardian.id, registrar.id] } },
      })
      await database!.student.delete({ where: { id: student.id } })
      await database!.gradeLevel.delete({ where: { id: grade.id } })
      await database!.academicYear.delete({ where: { id: year.id } })
      await database!.school.delete({ where: { id: school.id } })
      await database!.organization.delete({ where: { id: organization.id } })
    }
  })
})
