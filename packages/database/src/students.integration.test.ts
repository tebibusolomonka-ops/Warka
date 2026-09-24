import { afterAll, describe, expect, it } from 'vitest'
import { createDatabaseClient } from './index.js'
import {
  createStudent,
  findStudentById,
  findStudentByReference,
} from './students.js'

const testUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = testUrl
  ? createDatabaseClient({ DATABASE_URL: testUrl })
  : null

afterAll(async () => {
  await database?.$disconnect()
})

describe.skipIf(!database)('students in PostgreSQL', () => {
  it('persists unique references and optional identity fields', async () => {
    const first = await createStudent(database!, { givenName: '  Hana ' })
    const second = await createStudent(database!, {
      givenName: 'Marta',
      familyName: 'Bekele',
      dateOfBirth: '2018-02-28',
    })
    try {
      expect(first.studentReference).not.toBe(second.studentReference)
      expect(first.familyName).toBeNull()
      expect(first.dateOfBirth).toBeNull()
      expect(second.dateOfBirth?.toISOString()).toBe('2018-02-28T00:00:00.000Z')
      expect(await findStudentById(database!, first.id)).toEqual(first)
      expect(
        await findStudentByReference(database!, second.studentReference),
      ).toEqual(second)
      expect(
        await findStudentByReference(database!, 'WKA-00000000000000000000'),
      ).toBeNull()
      await expect(
        database!.student.create({
          data: {
            givenName: 'Another',
            studentReference: first.studentReference,
          },
        }),
      ).rejects.toThrow()
    } finally {
      await database!.student.deleteMany({
        where: { id: { in: [first.id, second.id] } },
      })
    }
  })
})
