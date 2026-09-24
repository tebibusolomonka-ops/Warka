import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { createDatabaseClient } from './index.js'
import { createUser } from './users.js'
import { createStudent } from './students.js'
import { createOrganization } from './organizations.js'
import { createSchool } from './schools.js'
import { assignUserToSchool } from './schoolMemberships.js'
import {
  DuplicateStudentAccessError,
  findLinkedUserForStudent,
  findStudentAccessForUser,
  linkStudentUser,
  removeStudentAccess,
} from './studentAccess.js'

const testUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = testUrl
  ? createDatabaseClient({ DATABASE_URL: testUrl })
  : null

afterAll(async () => {
  await database?.$disconnect()
})

describe.skipIf(!database)('student access', () => {
  it('requires explicit links even for staff, and isolates users and students', async () => {
    const user = await createUser(database!, {
      email: `staff-${randomUUID()}@example.test`,
      displayName: 'Staff',
    })
    const otherUser = await createUser(database!, {
      email: `other-${randomUUID()}@example.test`,
      displayName: 'Other',
    })
    const student = await createStudent(database!, {
      givenName: 'Test',
      familyName: 'Student',
    })
    const otherStudent = await createStudent(database!, {
      givenName: 'Second',
      familyName: 'Student',
    })
    const organization = await createOrganization(database!, {
      name: 'Test organization',
    })
    const school = await createSchool(database!, {
      organizationId: organization.id,
      name: 'Test school',
    })
    try {
      await assignUserToSchool(database!, {
        userId: user.id,
        schoolId: school.id,
        role: 'teacher',
      })
      expect(await findStudentAccessForUser(database!, user.id)).toBeNull()
      const link = await linkStudentUser(database!, user.id, student.id)
      expect(
        (await findStudentAccessForUser(database!, user.id))?.student.id,
      ).toBe(student.id)
      expect(
        (await findLinkedUserForStudent(database!, student.id))?.user.id,
      ).toBe(user.id)
      expect(await findStudentAccessForUser(database!, otherUser.id)).toBeNull()
      expect(
        await findLinkedUserForStudent(database!, otherStudent.id),
      ).toBeNull()
      await expect(
        linkStudentUser(database!, user.id, student.id),
      ).rejects.toBeInstanceOf(DuplicateStudentAccessError)
      await expect(
        linkStudentUser(database!, otherUser.id, student.id),
      ).rejects.toBeInstanceOf(DuplicateStudentAccessError)
      await expect(
        linkStudentUser(database!, user.id, otherStudent.id),
      ).rejects.toBeInstanceOf(DuplicateStudentAccessError)
      expect(link.userId).toBe(user.id)
      await removeStudentAccess(database!, student.id)
      expect(await findStudentAccessForUser(database!, user.id)).toBeNull()
      const second = await linkStudentUser(
        database!,
        otherUser.id,
        otherStudent.id,
      )
      expect(second.studentId).toBe(otherStudent.id)
    } finally {
      await database!.studentAccess.deleteMany({
        where: { userId: { in: [user.id, otherUser.id] } },
      })
      await database!.schoolMembership.deleteMany({
        where: { userId: user.id },
      })
      await database!.school.delete({ where: { id: school.id } })
      await database!.organization.delete({ where: { id: organization.id } })
      await database!.student.deleteMany({
        where: { id: { in: [student.id, otherStudent.id] } },
      })
      await database!.user.deleteMany({
        where: { id: { in: [user.id, otherUser.id] } },
      })
    }
  })
})
