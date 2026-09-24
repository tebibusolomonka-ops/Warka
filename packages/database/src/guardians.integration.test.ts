import { afterAll, describe, expect, it } from 'vitest'
import { createDatabaseClient } from './index.js'
import { createStudent } from './students.js'
import {
  createGuardian,
  DuplicateGuardianLinkError,
  linkGuardianToStudent,
  listGuardiansForStudent,
  listStudentsForGuardian,
} from './guardians.js'

const testUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = testUrl
  ? createDatabaseClient({ DATABASE_URL: testUrl })
  : null

afterAll(async () => {
  await database?.$disconnect()
})

describe.skipIf(!database)('guardian relationships in PostgreSQL', () => {
  it('links guardians without duplicating a student relationship', async () => {
    const first = await createStudent(database!, { givenName: 'Hana' })
    const second = await createStudent(database!, { givenName: 'Marta' })
    const guardian = await createGuardian(database!, {
      name: '  Selam ',
      phone: '+251 900 000 000',
    })

    try {
      const firstLink = await linkGuardianToStudent(database!, {
        studentId: first.id,
        guardianId: guardian.id,
        relationship: 'Aunt',
      })
      expect(firstLink.relationship).toBe('Aunt')
      await expect(
        linkGuardianToStudent(database!, {
          studentId: first.id,
          guardianId: guardian.id,
          relationship: 'Guardian',
        }),
      ).rejects.toBeInstanceOf(DuplicateGuardianLinkError)
      await linkGuardianToStudent(database!, {
        studentId: second.id,
        guardianId: guardian.id,
        relationship: 'Guardian',
      })
      expect(await listGuardiansForStudent(database!, first.id)).toEqual([
        { guardian, relationship: 'Aunt' },
      ])
      expect(await listGuardiansForStudent(database!, second.id)).toEqual([
        { guardian, relationship: 'Guardian' },
      ])
      expect(await listStudentsForGuardian(database!, guardian.id)).toEqual([
        { student: first, relationship: 'Aunt' },
        { student: second, relationship: 'Guardian' },
      ])
    } finally {
      await database!.studentGuardian.deleteMany({
        where: { studentId: { in: [first.id, second.id] } },
      })
      await database!.guardian.delete({ where: { id: guardian.id } })
      await database!.student.deleteMany({
        where: { id: { in: [first.id, second.id] } },
      })
    }
  })
})
