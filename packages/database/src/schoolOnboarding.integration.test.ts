import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { createDatabaseClient } from './index.js'
import {
  getSchoolOnboarding,
  pauseSchoolOnboarding,
  SchoolOnboardingStateError,
  startSchoolOnboarding,
} from './schoolOnboarding.js'

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = url ? createDatabaseClient({ DATABASE_URL: url }) : null
afterAll(async () => {
  await database?.$disconnect()
})

describe.skipIf(!database)('school onboarding in PostgreSQL', () => {
  it('starts, pauses, resumes, and prevents duplicate starts', async () => {
    const suffix = randomUUID()
    const organization = await database!.organization.create({
      data: { name: `Onboarding ${suffix}` },
    })
    const school = await database!.school.create({
      data: { organizationId: organization.id, name: `School ${suffix}` },
    })
    const actor = await database!.user.create({
      data: {
        email: `onboarding-${suffix}@example.test`,
        displayName: 'Administrator',
        schoolMemberships: {
          create: { schoolId: school.id, role: 'administrator' },
        },
      },
    })
    try {
      expect(
        await getSchoolOnboarding(database!, actor.id, school.id),
      ).toBeNull()
      const started = await startSchoolOnboarding(
        database!,
        actor.id,
        school.id,
      )
      expect(started.status).toBe('inProgress')
      await expect(
        startSchoolOnboarding(database!, actor.id, school.id),
      ).rejects.toBeInstanceOf(SchoolOnboardingStateError)
      expect(
        (await pauseSchoolOnboarding(database!, actor.id, school.id)).status,
      ).toBe('paused')
      expect(
        (await startSchoolOnboarding(database!, actor.id, school.id)).id,
      ).toBe(started.id)
    } finally {
      await database!.auditEvent.deleteMany({ where: { schoolId: school.id } })
      await database!.user.delete({ where: { id: actor.id } })
      await database!.school.delete({ where: { id: school.id } })
      await database!.organization.delete({ where: { id: organization.id } })
    }
  })
})
