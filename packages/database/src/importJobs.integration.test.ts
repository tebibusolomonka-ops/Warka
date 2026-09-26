import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import {
  cancelImportJob,
  createDatabaseClient,
  createImportJob,
  getImportJob,
  listSchoolImportJobs,
  recordImportValidation,
} from './index.js'

const testUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = testUrl
  ? createDatabaseClient({ DATABASE_URL: testUrl })
  : null

afterAll(async () => {
  await database?.$disconnect()
})

describe.skipIf(!database)('import jobs in PostgreSQL', () => {
  it('scopes jobs and issues to authorized school staff and enforces transitions', async () => {
    const suffix = randomUUID()
    const organization = await database!.organization.create({
      data: { name: 'Import organization ' + suffix },
    })
    const firstSchool = await database!.school.create({
      data: { organizationId: organization.id, name: 'Import first school' },
    })
    const secondSchool = await database!.school.create({
      data: { organizationId: organization.id, name: 'Import second school' },
    })
    const registrar = await database!.user.create({
      data: {
        email: 'import-registrar-' + suffix + '@example.test',
        displayName: 'Import registrar',
        schoolMemberships: {
          create: { schoolId: firstSchool.id, role: 'registrar' },
        },
      },
    })
    const teacher = await database!.user.create({
      data: {
        email: 'import-teacher-' + suffix + '@example.test',
        displayName: 'Import teacher',
        schoolMemberships: {
          create: { schoolId: firstSchool.id, role: 'teacher' },
        },
      },
    })
    const studentUser = await database!.user.create({
      data: {
        email: 'import-student-' + suffix + '@example.test',
        displayName: 'Student account',
      },
    })
    const guardianUser = await database!.user.create({
      data: {
        email: 'import-guardian-' + suffix + '@example.test',
        displayName: 'Guardian account',
      },
    })
    const bureauUser = await database!.user.create({
      data: {
        email: 'import-bureau-' + suffix + '@example.test',
        displayName: 'Bureau user',
        bureauAccesses: {
          create: { organizationId: organization.id, role: 'reportManager' },
        },
      },
    })
    try {
      const job = await createImportJob(database!, registrar.id, {
        schoolId: firstSchool.id,
        originalFileName: 'students.csv',
      })
      expect(job).toMatchObject({
        type: 'studentRegistration',
        status: 'uploaded',
        totalRows: 0,
      })
      await expect(
        createImportJob(database!, teacher.id, { schoolId: firstSchool.id }),
      ).rejects.toThrow('Import permission denied')
      for (const user of [studentUser, guardianUser, bureauUser])
        await expect(
          createImportJob(database!, user.id, { schoolId: firstSchool.id }),
        ).rejects.toThrow('Import permission denied')
      await expect(
        getImportJob(database!, registrar.id, secondSchool.id, job.id),
      ).rejects.toThrow('Import permission denied')
      expect(
        (
          await listSchoolImportJobs(database!, registrar.id, firstSchool.id)
        ).map((item) => item.id),
      ).toContain(job.id)
      const invalid = await recordImportValidation(
        database!,
        registrar.id,
        firstSchool.id,
        job.id,
        {
          totalRows: 2,
          validRows: 1,
          invalidRows: 1,
          issues: [
            {
              rowNumber: 2,
              severity: 'error',
              code: 'missingName',
              message: 'Given name is required',
            },
          ],
        },
      )
      expect(invalid.status).toBe('invalid')
      expect(invalid.issues).toMatchObject([
        { rowNumber: 2, code: 'missingName' },
      ])
      const validated = await recordImportValidation(
        database!,
        registrar.id,
        firstSchool.id,
        job.id,
        { totalRows: 2, validRows: 2, invalidRows: 0, issues: [] },
      )
      expect(validated.status).toBe('validated')
      expect(validated.issues).toHaveLength(0)
      await database!.importJob.update({
        where: { id: job.id },
        data: { status: 'applied', appliedAt: new Date() },
      })
      await expect(
        cancelImportJob(database!, registrar.id, firstSchool.id, job.id),
      ).rejects.toThrow('Import job cannot change')
      await expect(
        recordImportValidation(
          database!,
          registrar.id,
          firstSchool.id,
          job.id,
          {
            totalRows: 1,
            validRows: 1,
            invalidRows: 0,
            issues: [],
          },
        ),
      ).rejects.toThrow('Import job cannot change')
    } finally {
      await database!.importJob.deleteMany({
        where: { schoolId: { in: [firstSchool.id, secondSchool.id] } },
      })
      await database!.bureauAccess.deleteMany({
        where: { userId: bureauUser.id },
      })
      await database!.schoolMembership.deleteMany({
        where: { userId: { in: [registrar.id, teacher.id] } },
      })
      await database!.user.deleteMany({
        where: {
          id: {
            in: [
              registrar.id,
              teacher.id,
              studentUser.id,
              guardianUser.id,
              bureauUser.id,
            ],
          },
        },
      })
      await database!.school.deleteMany({
        where: { id: { in: [firstSchool.id, secondSchool.id] } },
      })
      await database!.organization.delete({ where: { id: organization.id } })
    }
  })
})
