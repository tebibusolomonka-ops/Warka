import { describe, expect, it } from 'vitest'
import { CreateAcademicYearSchema } from './academicYears.js'

const schoolId = '123e4567-e89b-42d3-a456-426614174000'

describe('academic year validation', () => {
  it('accepts a supplied name and ordered calendar dates', () => {
    expect(
      CreateAcademicYearSchema.parse({
        schoolId,
        name: '  2019 E.C.  ',
        startsOn: '2026-09-11',
        endsOn: '2027-09-10',
      }),
    ).toEqual({
      schoolId,
      name: '2019 E.C.',
      startsOn: '2026-09-11',
      endsOn: '2027-09-10',
    })
  })

  it('rejects reversed, equal, and invalid dates', () => {
    for (const [startsOn, endsOn] of [
      ['2027-09-10', '2026-09-11'],
      ['2026-09-11', '2026-09-11'],
      ['2026-02-30', '2027-09-10'],
    ]) {
      expect(() =>
        CreateAcademicYearSchema.parse({
          schoolId,
          name: 'Year one',
          startsOn,
          endsOn,
        }),
      ).toThrow()
    }
  })
})
