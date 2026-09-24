import { describe, expect, it } from 'vitest'
import { CreateGradeLevelSchema } from './gradeLevels.js'
import { CreateSchoolClassSchema } from './schoolClasses.js'

const id = '123e4567-e89b-42d3-a456-426614174000'

describe('academic structure validation', () => {
  it('normalizes grade and class names', () => {
    expect(
      CreateGradeLevelSchema.parse({ schoolId: id, name: ' Grade 1 ' }),
    ).toEqual({
      schoolId: id,
      name: 'Grade 1',
    })
    expect(
      CreateSchoolClassSchema.parse({
        schoolId: id,
        academicYearId: id,
        gradeLevelId: id,
        name: ' Section A ',
      }),
    ).toMatchObject({ name: 'Section A' })
  })

  it('rejects blank names and malformed identifiers', () => {
    expect(() =>
      CreateGradeLevelSchema.parse({ schoolId: id, name: ' ' }),
    ).toThrow()
    expect(() =>
      CreateSchoolClassSchema.parse({
        schoolId: id,
        academicYearId: 'not-an-id',
        gradeLevelId: id,
        name: 'A',
      }),
    ).toThrow()
  })
})
