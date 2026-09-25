import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { createDatabaseClient } from './index.js'
import { createGuardian } from './guardians.js'
import { createStudent } from './students.js'
import { createUser } from './users.js'
import { createOrganization } from './organizations.js'
import { createSchool } from './schools.js'
import { assignUserToSchool } from './schoolMemberships.js'
import { linkStudentUser } from './studentAccess.js'
import {
  DuplicateGuardianAccessError,
  findGuardianAccessForUser,
  findLinkedUserForGuardian,
  linkGuardianUser,
  removeGuardianAccess,
} from './guardianAccess.js'

const testUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = testUrl
  ? createDatabaseClient({ DATABASE_URL: testUrl })
  : null

afterAll(async () => {
  await database?.$disconnect()
})

describe.skipIf(!database)('guardian access in PostgreSQL', () => {
  it('requires an explicit link for staff and student users and isolates guardians', async () => {
    const suffix = randomUUID()
    const staff = await createUser(database!, {
      email: `guardian-staff-${suffix}@example.test`,
      displayName: 'Staff',
    })
    const studentUser = await createUser(database!, {
      email: `guardian-student-${suffix}@example.test`,
      displayName: 'Student user',
    })
    const guardian = await createGuardian(database!, { name: 'First guardian' })
    const otherGuardian = await createGuardian(database!, {
      name: 'Second guardian',
    })
    const student = await createStudent(database!, { givenName: 'Child' })
    const organization = await createOrganization(database!, {
      name: 'Guardian access test',
    })
    const school = await createSchool(database!, {
      organizationId: organization.id,
      name: 'Access school',
    })
    try {
      await assignUserToSchool(database!, {
        userId: staff.id,
        schoolId: school.id,
        role: 'teacher',
      })
      await linkStudentUser(database!, studentUser.id, student.id)
      expect(await findGuardianAccessForUser(database!, staff.id)).toBeNull()
      expect(
        await findGuardianAccessForUser(database!, studentUser.id),
      ).toBeNull()
      expect(
        await findLinkedUserForGuardian(database!, otherGuardian.id),
      ).toBeNull()
      const access = await linkGuardianUser(database!, staff.id, guardian.id)
      expect(access.guardianId).toBe(guardian.id)
      expect(
        (await findGuardianAccessForUser(database!, staff.id))?.guardian.id,
      ).toBe(guardian.id)
      expect(
        (await findLinkedUserForGuardian(database!, guardian.id))?.user.id,
      ).toBe(staff.id)
      await expect(
        linkGuardianUser(database!, staff.id, guardian.id),
      ).rejects.toBeInstanceOf(DuplicateGuardianAccessError)
      await expect(
        linkGuardianUser(database!, studentUser.id, guardian.id),
      ).rejects.toBeInstanceOf(DuplicateGuardianAccessError)
      await expect(
        linkGuardianUser(database!, staff.id, otherGuardian.id),
      ).rejects.toBeInstanceOf(DuplicateGuardianAccessError)
      expect(
        await findGuardianAccessForUser(database!, studentUser.id),
      ).toBeNull()
      await removeGuardianAccess(database!, guardian.id)
      expect(await findGuardianAccessForUser(database!, staff.id)).toBeNull()
      await linkGuardianUser(database!, studentUser.id, otherGuardian.id)
      expect(
        (await findGuardianAccessForUser(database!, studentUser.id))?.guardian
          .id,
      ).toBe(otherGuardian.id)
      expect(await findLinkedUserForGuardian(database!, guardian.id)).toBeNull()
    } finally {
      await database!.guardianAccess.deleteMany({
        where: { userId: { in: [staff.id, studentUser.id] } },
      })
      await database!.studentAccess.deleteMany({
        where: { userId: studentUser.id },
      })
      await database!.schoolMembership.deleteMany({
        where: { userId: staff.id },
      })
      await database!.school.delete({ where: { id: school.id } })
      await database!.organization.delete({ where: { id: organization.id } })
      await database!.student.delete({ where: { id: student.id } })
      await database!.guardian.deleteMany({
        where: { id: { in: [guardian.id, otherGuardian.id] } },
      })
      await database!.user.deleteMany({
        where: { id: { in: [staff.id, studentUser.id] } },
      })
    }
  })
})
