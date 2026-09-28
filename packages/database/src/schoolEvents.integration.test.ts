import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { createDatabaseClient } from './index.js'
import {
  createSchoolEvent,
  editDraftSchoolEvent,
  SchoolEventAccessError,
  SchoolEventStateError,
  transitionSchoolEvent,
} from './schoolEvents.js'
import { mayViewSchoolEvent, setSchoolEventAudience } from './eventAudiences.js'

const testUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = testUrl
  ? createDatabaseClient({ DATABASE_URL: testUrl })
  : null
afterAll(async () => database?.$disconnect())

describe.skipIf(!database)('school events in PostgreSQL', () => {
  it('keeps draft content private and permits only controlled school lifecycle actions', async () => {
    const db = database!
    const organization = await db.organization.create({
      data: { name: `Events ${randomUUID()}` },
    })
    const school = await db.school.create({
      data: { organizationId: organization.id, name: 'Event school' },
    })
    const otherSchool = await db.school.create({
      data: { organizationId: organization.id, name: 'Other school' },
    })
    const admin = await db.user.create({
      data: { email: `${randomUUID()}@example.test`, displayName: 'Admin' },
    })
    const outsider = await db.user.create({
      data: { email: `${randomUUID()}@example.test`, displayName: 'Outsider' },
    })
    try {
      await db.schoolMembership.create({
        data: {
          schoolId: school.id,
          userId: admin.id,
          role: 'administrator',
          startsAt: new Date('2026-01-01'),
        },
      })
      const startsAt = new Date(Date.now() + 86400000)
      const endsAt = new Date(startsAt.getTime() + 3600000)
      const input = {
        schoolId: school.id,
        title: 'Science fair',
        description: 'Families are welcome.',
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        schoolLocation: 'School hall',
      }
      await expect(
        createSchoolEvent(db, outsider.id, input),
      ).rejects.toBeInstanceOf(SchoolEventAccessError)
      await expect(
        createSchoolEvent(db, admin.id, {
          ...input,
          endsAt: startsAt.toISOString(),
        }),
      ).rejects.toThrow()
      await expect(
        createSchoolEvent(db, admin.id, {
          ...input,
          description: '<script>unsafe</script>',
        }),
      ).rejects.toThrow()
      const event = await createSchoolEvent(db, admin.id, input)
      expect(event.status).toBe('draft')
      expect(
        await mayViewSchoolEvent(db, outsider.id, school.id, event.id),
      ).toBe(false)
      await expect(
        transitionSchoolEvent(db, admin.id, school.id, event.id, 'publish'),
      ).rejects.toBeInstanceOf(SchoolEventStateError)
      const foreignGrade = await db.gradeLevel.create({
        data: { schoolId: otherSchool.id, name: 'Foreign grade' },
      })
      await expect(
        setSchoolEventAudience(db, admin.id, school.id, event.id, {
          scope: 'grade',
          gradeLevelId: foreignGrade.id,
        }),
      ).rejects.toBeInstanceOf(SchoolEventStateError)
      await setSchoolEventAudience(db, admin.id, school.id, event.id, {
        scope: 'wholeSchool',
      })
      await expect(
        editDraftSchoolEvent(db, admin.id, otherSchool.id, event.id, {
          ...input,
          title: 'Wrong school',
        }),
      ).rejects.toBeInstanceOf(SchoolEventAccessError)
      await editDraftSchoolEvent(db, admin.id, school.id, event.id, {
        ...input,
        title: 'Updated science fair',
      })
      expect(
        (
          await transitionSchoolEvent(
            db,
            admin.id,
            school.id,
            event.id,
            'publish',
          )
        ).status,
      ).toBe('published')
      expect(
        await mayViewSchoolEvent(db, outsider.id, otherSchool.id, event.id),
      ).toBe(false)
      expect(
        await mayViewSchoolEvent(db, outsider.id, school.id, event.id),
      ).toBe(false)
      await expect(
        editDraftSchoolEvent(db, admin.id, school.id, event.id, input),
      ).rejects.toBeInstanceOf(SchoolEventStateError)
      expect(
        (
          await transitionSchoolEvent(
            db,
            admin.id,
            school.id,
            event.id,
            'complete',
          )
        ).status,
      ).toBe('completed')
      await expect(
        transitionSchoolEvent(db, admin.id, school.id, event.id, 'cancel'),
      ).rejects.toBeInstanceOf(SchoolEventStateError)
    } finally {
      await db.schoolEventAudience.deleteMany({
        where: { schoolId: school.id },
      })
      await db.schoolEvent.deleteMany({ where: { schoolId: school.id } })
      await db.gradeLevel.deleteMany({ where: { schoolId: otherSchool.id } })
      await db.schoolMembership.deleteMany({ where: { schoolId: school.id } })
      await db.user.deleteMany({
        where: { id: { in: [admin.id, outsider.id] } },
      })
      await db.school.deleteMany({
        where: { id: { in: [school.id, otherSchool.id] } },
      })
      await db.organization.delete({ where: { id: organization.id } })
    }
  })
})
