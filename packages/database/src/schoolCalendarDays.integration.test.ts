import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { createDatabaseClient, createSchoolCalendarDay } from './index.js'

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = url ? createDatabaseClient({ DATABASE_URL: url }) : null
afterAll(async () => database?.$disconnect())

describe.skipIf(!database)('school calendar days in PostgreSQL', () => {
  it('keeps one explicit day per school/date within its academic year', async () => {
    const suffix = randomUUID()
    const organization = await database!.organization.create({
      data: { name: `Calendar ${suffix}` },
    })
    const school = await database!.school.create({
      data: { organizationId: organization.id, name: 'Calendar school' },
    })
    const year = await database!.academicYear.create({
      data: {
        schoolId: school.id,
        name: 'Calendar year',
        startsOn: new Date('2026-01-01'),
        endsOn: new Date('2026-12-31'),
      },
    })
    try {
      const input = {
        schoolId: school.id,
        academicYearId: year.id,
        date: '2026-09-28',
        dayType: 'closure' as const,
        label: 'Weather closure',
      }
      const day = await createSchoolCalendarDay(database!, input)
      expect(day.dayType).toBe('closure')
      await expect(createSchoolCalendarDay(database!, input)).rejects.toThrow(
        'Conflicting calendar day',
      )
      await expect(
        createSchoolCalendarDay(database!, { ...input, date: '2027-01-01' }),
      ).rejects.toThrow('outside the school year')
    } finally {
      await database!.schoolCalendarDay.deleteMany({
        where: { schoolId: school.id },
      })
      await database!.academicYear.delete({ where: { id: year.id } })
      await database!.school.delete({ where: { id: school.id } })
      await database!.organization.delete({ where: { id: organization.id } })
    }
  })
})
