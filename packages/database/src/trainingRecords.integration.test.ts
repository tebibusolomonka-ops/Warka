import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { createDatabaseClient } from './index.js'
import {
  assignTrainingRecord,
  finishTrainingRecord,
  listTrainingRecords,
  TrainingRecordStateError,
} from './trainingRecords.js'

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = url ? createDatabaseClient({ DATABASE_URL: url }) : null
afterAll(async () => {
  await database?.$disconnect()
})

describe.skipIf(!database)('training records in PostgreSQL', () => {
  it('tracks training without changing roles and requires a reason for waiver', async () => {
    const suffix = randomUUID()
    const org = await database!.organization.create({
      data: { name: `Training ${suffix}` },
    })
    const school = await database!.school.create({
      data: { organizationId: org.id, name: `Training School ${suffix}` },
    })
    const admin = await database!.user.create({
      data: {
        email: `training-admin-${suffix}@example.test`,
        displayName: 'Admin',
        schoolMemberships: {
          create: { schoolId: school.id, role: 'administrator' },
        },
      },
    })
    const teacher = await database!.user.create({
      data: {
        email: `training-teacher-${suffix}@example.test`,
        displayName: 'Teacher',
        schoolMemberships: { create: { schoolId: school.id, role: 'teacher' } },
      },
    })
    try {
      const record = await assignTrainingRecord(
        database!,
        admin.id,
        school.id,
        teacher.id,
        'academicResults',
      )
      await expect(
        finishTrainingRecord(
          database!,
          admin.id,
          school.id,
          record.id,
          'waived',
          'x',
        ),
      ).rejects.toBeInstanceOf(TrainingRecordStateError)
      expect(
        (
          await finishTrainingRecord(
            database!,
            admin.id,
            school.id,
            record.id,
            'completed',
          )
        ).status,
      ).toBe('completed')
      expect(
        (await listTrainingRecords(database!, admin.id, school.id)).map(
          (item) => item.id,
        ),
      ).toContain(record.id)
      expect(
        (
          await database!.schoolMembership.findUniqueOrThrow({
            where: {
              userId_schoolId: { userId: teacher.id, schoolId: school.id },
            },
          })
        ).role,
      ).toBe('teacher')
    } finally {
      await database!.auditEvent.deleteMany({ where: { schoolId: school.id } })
      await database!.trainingRecord.deleteMany({
        where: { schoolId: school.id },
      })
      await database!.user.deleteMany({
        where: { id: { in: [admin.id, teacher.id] } },
      })
      await database!.school.delete({ where: { id: school.id } })
      await database!.organization.delete({ where: { id: org.id } })
    }
  })
})
