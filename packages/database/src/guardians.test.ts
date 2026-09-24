import { describe, expect, it } from 'vitest'
import { CreateGuardianSchema, LinkGuardianSchema } from './guardians.js'

const studentId = '123e4567-e89b-42d3-a456-426614174000'
const guardianId = '123e4567-e89b-42d3-a456-426614174001'

describe('guardian validation', () => {
  it('accepts a name without forcing both contact methods', () => {
    expect(CreateGuardianSchema.parse({ name: '  Selam  ' })).toEqual({
      name: 'Selam',
    })
    expect(
      CreateGuardianSchema.parse({
        name: 'Selam',
        email: '  SELAM@example.com  ',
      }),
    ).toEqual({ name: 'Selam', email: 'selam@example.com' })
    expect(
      CreateGuardianSchema.parse({ name: 'Selam', phone: '+251 900 000 000' }),
    ).toMatchObject({ phone: '+251 900 000 000' })
  })

  it('keeps relationship labels supplied by the school', () => {
    expect(
      LinkGuardianSchema.parse({
        studentId,
        guardianId,
        relationship: '  Aunt  ',
      }),
    ).toEqual({ studentId, guardianId, relationship: 'Aunt' })
    expect(() =>
      LinkGuardianSchema.parse({
        studentId,
        guardianId,
        relationship: ' ',
      }),
    ).toThrow()
  })
})
