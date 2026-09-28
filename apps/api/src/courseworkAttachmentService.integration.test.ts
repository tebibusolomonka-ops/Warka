import { randomUUID } from 'node:crypto'
import { Readable } from 'node:stream'
import { afterAll, describe, expect, it } from 'vitest'
import { createDatabaseClient } from '@warka/database'
import { courseworkAttachmentService } from './courseworkAttachmentService.js'
import {
  FileAssetAccessError,
  requireFileAssetAccess,
} from './fileAssetAccess.js'
import { FakeFileScanner } from './fileScanner.js'
import { processPendingFileScan } from './fileScanWorkflow.js'
import type { FileStorage } from './fileStorage.js'

const testUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = testUrl
  ? createDatabaseClient({ DATABASE_URL: testUrl })
  : null
afterAll(async () => database?.$disconnect())

describe.skipIf(!database)(
  'coursework attachment security in PostgreSQL',
  () => {
    it('keeps a draft and unscanned attachment private, then gates access on publication and clean scan', async () => {
      const organization = await database!.organization.create({
        data: { name: `Coursework files ${randomUUID()}` },
      })
      const school = await database!.school.create({
        data: {
          organizationId: organization.id,
          name: 'Coursework files school',
        },
      })
      const teacher = await database!.user.create({
        data: {
          email: `coursework-file-teacher-${randomUUID()}@example.test`,
          displayName: 'Coursework Teacher',
          schoolMemberships: {
            create: {
              schoolId: school.id,
              role: 'teacher',
              startsAt: new Date('2026-01-01'),
            },
          },
        },
      })
      const learner = await database!.user.create({
        data: {
          email: `coursework-file-student-${randomUUID()}@example.test`,
          displayName: 'Coursework Student',
        },
      })
      const student = await database!.student.create({
        data: {
          studentReference: `CW-${randomUUID()}`,
          givenName: 'Synthetic Student',
          studentAccess: { create: { userId: learner.id } },
        },
      })
      const stored = new Map<string, Uint8Array>()
      const storage: FileStorage = {
        async put(bytes) {
          const key = `asset_${randomUUID()}`
          stored.set(key, bytes)
          return { key, sizeBytes: bytes.byteLength }
        },
        async get(key) {
          const bytes = stored.get(key)
          if (!bytes) throw new Error('Missing stored test file')
          return { stream: Readable.from([bytes]), sizeBytes: bytes.byteLength }
        },
        async exists(key) {
          return stored.has(key)
        },
        async delete(key) {
          stored.delete(key)
        },
        async metadata(key) {
          return { sizeBytes: stored.get(key)?.byteLength ?? 0 }
        },
      }
      try {
        const year = await database!.academicYear.create({
          data: {
            schoolId: school.id,
            name: 'Coursework year',
            startsOn: new Date('2026-01-01'),
            endsOn: new Date('2026-12-31'),
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
        const subject = await database!.subject.create({
          data: { schoolId: school.id, name: 'Mathematics' },
        })
        const teaching = await database!.teachingAssignment.create({
          data: {
            schoolId: school.id,
            academicYearId: year.id,
            schoolClassId: schoolClass.id,
            subjectId: subject.id,
            userId: teacher.id,
            startsAt: new Date('2026-01-01'),
          },
        })
        await database!.enrollment.create({
          data: {
            studentId: student.id,
            schoolId: school.id,
            academicYearId: year.id,
            gradeLevelId: grade.id,
            schoolClassId: schoolClass.id,
            status: 'approved',
          },
        })
        const assignment = await database!.courseworkAssignment.create({
          data: {
            schoolId: school.id,
            academicYearId: year.id,
            schoolClassId: schoolClass.id,
            subjectId: subject.id,
            teachingAssignmentId: teaching.id,
            createdById: teacher.id,
            title: 'Read',
            instructions: 'Read the attached notes.',
            dueAt: new Date('2026-11-01'),
          },
        })
        const uploaded = await courseworkAttachmentService(
          database!,
          storage,
        ).upload(teacher.id, school.id, assignment.id, {
          bytes: Buffer.from('Synthetic coursework notes'),
          originalFileName: 'notes.txt',
          claimedContentType: 'text/plain',
        })
        expect(uploaded.status).toBe('pending')
        await expect(
          requireFileAssetAccess(
            database!,
            learner.id,
            uploaded.fileAssetId,
            'read',
          ),
        ).rejects.toBeInstanceOf(FileAssetAccessError)
        const scan = await database!.fileScan.findFirstOrThrow({
          where: { fileAssetId: uploaded.fileAssetId },
        })
        await processPendingFileScan({
          database: database!,
          storage,
          scanner: new FakeFileScanner([{ status: 'clean' }]),
          scanId: scan.id,
        })
        await expect(
          requireFileAssetAccess(
            database!,
            learner.id,
            uploaded.fileAssetId,
            'read',
          ),
        ).rejects.toBeInstanceOf(FileAssetAccessError)
        await database!.courseworkAssignment.update({
          where: { id: assignment.id },
          data: {
            status: 'published',
            assignedAt: new Date(),
            publishedAt: new Date(),
          },
        })
        await expect(
          requireFileAssetAccess(
            database!,
            learner.id,
            uploaded.fileAssetId,
            'read',
          ),
        ).resolves.toMatchObject({ id: uploaded.fileAssetId })
        await database!.fileAsset.update({
          where: { id: uploaded.fileAssetId },
          data: { status: 'quarantined' },
        })
        await expect(
          requireFileAssetAccess(
            database!,
            learner.id,
            uploaded.fileAssetId,
            'read',
          ),
        ).rejects.toBeInstanceOf(FileAssetAccessError)
      } finally {
        const assets = await database!.fileAsset.findMany({
          where: { schoolId: school.id },
          select: { id: true },
        })
        const scans = await database!.fileScan.findMany({
          where: { fileAssetId: { in: assets.map((item) => item.id) } },
          select: { id: true },
        })
        await database!.scheduledTaskExecution.deleteMany({
          where: {
            taskType: 'fileScan',
            resourceId: { in: scans.map((item) => item.id) },
          },
        })
        await database!.notification.deleteMany({
          where: { userId: { in: [teacher.id, learner.id] } },
        })
        await database!.fileScan.deleteMany({
          where: { fileAssetId: { in: assets.map((item) => item.id) } },
        })
        await database!.courseworkAttachment.deleteMany({
          where: { schoolId: school.id },
        })
        await database!.fileAsset.deleteMany({ where: { schoolId: school.id } })
        await database!.courseworkAssignment.deleteMany({
          where: { schoolId: school.id },
        })
        await database!.enrollment.deleteMany({
          where: { schoolId: school.id },
        })
        await database!.teachingAssignment.deleteMany({
          where: { schoolId: school.id },
        })
        await database!.subject.deleteMany({ where: { schoolId: school.id } })
        await database!.schoolClass.deleteMany({
          where: { schoolId: school.id },
        })
        await database!.gradeLevel.deleteMany({
          where: { schoolId: school.id },
        })
        await database!.academicYear.deleteMany({
          where: { schoolId: school.id },
        })
        await database!.studentAccess.deleteMany({
          where: { studentId: student.id },
        })
        await database!.student.delete({ where: { id: student.id } })
        await database!.schoolMembership.deleteMany({
          where: { userId: teacher.id },
        })
        await database!.user.deleteMany({
          where: { id: { in: [teacher.id, learner.id] } },
        })
        await database!.school.delete({ where: { id: school.id } })
        await database!.organization.delete({ where: { id: organization.id } })
      }
    })
  },
)
