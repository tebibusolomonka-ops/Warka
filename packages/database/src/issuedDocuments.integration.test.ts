import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { createDatabaseClient } from './index.js'
import {
  DocumentPermissionError,
  DocumentStateError,
  correctDocument,
  withdrawDocument,
  DocumentSnapshotSchema,
  DocumentSourceError,
  findDocumentByReference,
  findIssuedDocument,
  issueDocument,
  listSchoolDocuments,
  listStudentDocuments,
} from './issuedDocuments.js'

const testUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = testUrl
  ? createDatabaseClient({ DATABASE_URL: testUrl })
  : null

afterAll(async () => {
  await database?.$disconnect()
})

describe.skipIf(!database)('issued documents in PostgreSQL', () => {
  it('issues only from official school results and preserves reference and history', async () => {
    const organization = await database!.organization.create({
      data: { name: 'Document test ' + randomUUID() },
    })
    const school = await database!.school.create({
      data: { organizationId: organization.id, name: 'Issuing school' },
    })
    const otherSchool = await database!.school.create({
      data: { organizationId: organization.id, name: 'Other school' },
    })
    const actor = await database!.user.create({
      data: {
        email: 'document-' + randomUUID() + '@example.test',
        displayName: 'Document approver',
        schoolMemberships: {
          create: { schoolId: school.id, role: 'approver' },
        },
      },
    })
    const teacher = await database!.user.create({
      data: {
        email: 'teacher-' + randomUUID() + '@example.test',
        displayName: 'Document teacher',
        schoolMemberships: {
          create: { schoolId: school.id, role: 'teacher' },
        },
      },
    })
    const year = await database!.academicYear.create({
      data: {
        schoolId: school.id,
        name: 'Document year',
        startsOn: new Date('2026-01-01'),
        endsOn: new Date('2026-12-31'),
      },
    })
    const grade = await database!.gradeLevel.create({
      data: { schoolId: school.id, name: 'Document grade' },
    })
    const schoolClass = await database!.schoolClass.create({
      data: {
        schoolId: school.id,
        academicYearId: year.id,
        gradeLevelId: grade.id,
        name: 'Document class',
      },
    })
    const subject = await database!.subject.create({
      data: { schoolId: school.id, name: 'Document subject' },
    })
    const period = await database!.gradingPeriod.create({
      data: {
        schoolId: school.id,
        academicYearId: year.id,
        name: 'Document period',
        startsOn: new Date('2026-01-01'),
        endsOn: new Date('2026-06-30'),
      },
    })
    const student = await database!.student.create({
      data: { studentReference: 'DOC-' + randomUUID(), givenName: 'Mira' },
    })
    const enrollment = await database!.enrollment.create({
      data: {
        studentId: student.id,
        schoolId: school.id,
        academicYearId: year.id,
        gradeLevelId: grade.id,
        schoolClassId: schoolClass.id,
        status: 'approved',
        approvedAt: new Date(),
        approvedById: actor.id,
      },
    })
    const context = {
      schoolId: school.id,
      studentId: student.id,
      academicYearId: year.id,
      documentType: 'transcript' as const,
    }
    try {
      await expect(
        issueDocument(database!, actor.id, context),
      ).rejects.toBeInstanceOf(DocumentSourceError)
      const resultSet = await database!.resultSet.create({
        data: {
          schoolId: school.id,
          academicYearId: year.id,
          gradingPeriodId: period.id,
          schoolClassId: schoolClass.id,
          subjectId: subject.id,
          status: 'pending',
          submittedAt: new Date(),
          submittedById: actor.id,
        },
      })
      await database!.publishedResult.create({
        data: {
          schoolId: school.id,
          resultSetId: resultSet.id,
          studentId: student.id,
          enrollmentId: enrollment.id,
          percentage: 85,
          gradeLabel: 'B',
          currentPercentage: 85,
          currentGradeLabel: 'B',
        },
      })
      await expect(
        issueDocument(database!, actor.id, context),
      ).rejects.toBeInstanceOf(DocumentSourceError)
      await database!.resultSet.update({
        where: { id: resultSet.id },
        data: {
          status: 'published',
          publishedAt: new Date(),
          publishedById: actor.id,
        },
      })
      const first = await issueDocument(database!, actor.id, context)
      const second = await issueDocument(database!, actor.id, {
        ...context,
        documentType: 'reportCard',
      })
      expect(first.status).toBe('active')
      const originalSnapshot = DocumentSnapshotSchema.parse(first.snapshot)
      expect(originalSnapshot).toEqual({
        student: {
          displayName: 'Mira',
          studentReference: student.studentReference,
        },
        issuingSchool: 'Issuing school',
        documentType: 'transcript',
        issuedAt: first.issuedAt.toISOString(),
        academicYear: 'Document year',
        subjects: [
          {
            subject: 'Document subject',
            gradingPeriod: 'Document period',
            percentage: 85,
            gradeLabel: 'B',
          },
        ],
      })
      const scheme = await database!.gradingScheme.create({
        data: {
          schoolId: school.id,
          bands: {
            create: { label: 'B', minimumPercentage: 80 },
          },
        },
        include: { bands: true },
      })
      await database!.gradeBand.update({
        where: { id: scheme.bands[0]!.id },
        data: { minimumPercentage: 90 },
      })
      await database!.school.update({
        where: { id: school.id },
        data: { name: 'Renamed issuing school' },
      })
      await database!.academicYear.update({
        where: { id: year.id },
        data: { name: 'Renamed academic year' },
      })
      await database!.student.update({
        where: { id: student.id },
        data: { familyName: 'Changed' },
      })
      await database!.publishedResult.updateMany({
        where: { schoolId: school.id, studentId: student.id },
        data: { currentPercentage: 91, currentGradeLabel: 'A' },
      })
      await database!.enrollment.update({
        where: { id: enrollment.id },
        data: {
          status: 'withdrawn',
          withdrawnAt: new Date(),
          withdrawnById: actor.id,
        },
      })
      const persisted = await findIssuedDocument(database!, school.id, first.id)
      expect(DocumentSnapshotSchema.parse(persisted?.snapshot)).toEqual(
        originalSnapshot,
      )
      expect(first.verificationReference).toMatch(/^WRK-[A-F0-9]{32}$/)
      expect(second.verificationReference).not.toBe(first.verificationReference)
      expect(
        (await findDocumentByReference(database!, first.verificationReference))
          ?.id,
      ).toBe(first.id)
      expect(
        (await findIssuedDocument(database!, school.id, first.id))?.id,
      ).toBe(first.id)
      expect(
        await findIssuedDocument(database!, otherSchool.id, first.id),
      ).toBeNull()
      expect(
        (await listStudentDocuments(database!, school.id, student.id)).map(
          (item) => item.id,
        ),
      ).toContain(first.id)
      expect(
        await listStudentDocuments(database!, otherSchool.id, student.id),
      ).toEqual([])
      expect((await listSchoolDocuments(database!, school.id)).length).toBe(2)
      await expect(
        issueDocument(database!, actor.id, {
          ...context,
          schoolId: otherSchool.id,
        }),
      ).rejects.toBeInstanceOf(DocumentPermissionError)
      await expect(
        correctDocument(
          database!,
          teacher.id,
          school.id,
          first.id,
          'Corrected result',
        ),
      ).rejects.toBeInstanceOf(DocumentPermissionError)
      await expect(
        withdrawDocument(
          database!,
          teacher.id,
          school.id,
          first.id,
          'Teacher request',
        ),
      ).rejects.toBeInstanceOf(DocumentPermissionError)
      await expect(
        correctDocument(
          database!,
          actor.id,
          otherSchool.id,
          first.id,
          'Wrong school',
        ),
      ).rejects.toBeInstanceOf(DocumentPermissionError)
      const replacement = await correctDocument(
        database!,
        actor.id,
        school.id,
        first.id,
        'Official result correction',
      )
      expect(replacement.status).toBe('active')
      expect(replacement.supersedesId).toBe(first.id)
      expect(replacement.verificationReference).not.toBe(
        first.verificationReference,
      )
      const prior = await findDocumentByReference(
        database!,
        first.verificationReference,
      )
      expect(prior?.status).toBe('corrected')
      expect(prior?.correctionReason).toBe('Official result correction')
      expect(prior?.correctedById).toBe(actor.id)
      expect(prior?.correctedAt).not.toBeNull()
      expect(
        DocumentSnapshotSchema.parse(replacement.snapshot).subjects[0]
          ?.gradeLabel,
      ).toBe('A')
      await expect(
        correctDocument(database!, actor.id, school.id, first.id, 'Again'),
      ).rejects.toBeInstanceOf(DocumentStateError)
      const withdrawn = await withdrawDocument(
        database!,
        actor.id,
        school.id,
        replacement.id,
        'Issued in error',
      )
      expect(withdrawn.status).toBe('withdrawn')
      expect(withdrawn.withdrawalReason).toBe('Issued in error')
      expect(withdrawn.withdrawnById).toBe(actor.id)
      expect(withdrawn.withdrawnAt).not.toBeNull()
      expect(
        (
          await findDocumentByReference(
            database!,
            replacement.verificationReference,
          )
        )?.status,
      ).toBe('withdrawn')
      await expect(
        withdrawDocument(
          database!,
          actor.id,
          school.id,
          replacement.id,
          'Again',
        ),
      ).rejects.toBeInstanceOf(DocumentStateError)
      await expect(
        database!.issuedDocument.update({
          where: { id: second.id },
          data: { verificationReference: first.verificationReference },
        }),
      ).rejects.toThrow()
    } finally {
      await database!.issuedDocument.deleteMany({
        where: { schoolId: school.id, supersedesId: { not: null } },
      })
      await database!.issuedDocument.deleteMany({
        where: { schoolId: school.id },
      })
      await database!.gradeBand.deleteMany({
        where: { gradingScheme: { schoolId: school.id } },
      })
      await database!.gradingScheme.deleteMany({
        where: { schoolId: school.id },
      })
      await database!.publishedResult.deleteMany({
        where: { schoolId: school.id },
      })
      await database!.resultSet.deleteMany({ where: { schoolId: school.id } })
      await database!.enrollment.deleteMany({ where: { schoolId: school.id } })
      await database!.gradingPeriod.deleteMany({
        where: { schoolId: school.id },
      })
      await database!.schoolClass.deleteMany({ where: { schoolId: school.id } })
      await database!.subject.deleteMany({ where: { schoolId: school.id } })
      await database!.gradeLevel.deleteMany({ where: { schoolId: school.id } })
      await database!.academicYear.deleteMany({
        where: { schoolId: school.id },
      })
      await database!.student.delete({ where: { id: student.id } })
      await database!.schoolMembership.deleteMany({
        where: { schoolId: school.id },
      })
      await database!.user.delete({ where: { id: teacher.id } })
      await database!.user.delete({ where: { id: actor.id } })
      await database!.school.delete({ where: { id: otherSchool.id } })
      await database!.school.delete({ where: { id: school.id } })
      await database!.organization.delete({ where: { id: organization.id } })
    }
  })
})
