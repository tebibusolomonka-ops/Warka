import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { createDatabaseClient, createTimetablePeriod } from './index.js'

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = url ? createDatabaseClient({ DATABASE_URL: url }) : null
afterAll(async () => database?.$disconnect())

describe.skipIf(!database)('timetable periods in PostgreSQL', () => {
  it('accepts ordered periods and rejects overlaps and duplicate order', async () => {
    const suffix = randomUUID()
    const organization = await database!.organization.create({
      data: { name: `Timetable periods ${suffix}` },
    })
    const school = await database!.school.create({
      data: { organizationId: organization.id, name: 'Periods school' },
    })
    try {
      const base = {
        schoolId: school.id,
        name: 'First lesson',
        startTime: '08:00',
        endTime: '08:45',
        sortOrder: 1,
        instructional: true,
      }
      await createTimetablePeriod(database!, base)
      await expect(
        createTimetablePeriod(database!, {
          ...base,
          name: 'Overlap',
          startTime: '08:30',
          endTime: '09:00',
          sortOrder: 2,
        }),
      ).rejects.toThrow('overlaps')
      await expect(
        createTimetablePeriod(database!, {
          ...base,
          name: 'Same order',
          startTime: '09:00',
          endTime: '09:30',
        }),
      ).rejects.toThrow('conflicts')
      const breakPeriod = await createTimetablePeriod(database!, {
        ...base,
        name: 'Break',
        startTime: '08:45',
        endTime: '09:00',
        sortOrder: 2,
        instructional: false,
      })
      expect(breakPeriod.instructional).toBe(false)
    } finally {
      await database!.timetablePeriod.deleteMany({
        where: { schoolId: school.id },
      })
      await database!.school.delete({ where: { id: school.id } })
      await database!.organization.delete({ where: { id: organization.id } })
    }
  })
})
