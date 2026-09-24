import { describe, expect, it } from 'vitest'
import { CreateStudentSchema, generateStudentReference } from './students.js'

describe('student validation and references', () => {
  it('accepts minimal identity and optional supplied fields', () => {
    expect(CreateStudentSchema.parse({ givenName: '  Hana  ' })).toEqual({
      givenName: 'Hana',
    })
    expect(
      CreateStudentSchema.parse({
        givenName: 'Hana',
        familyName: '  Bekele  ',
        dateOfBirth: '2018-02-28',
      }),
    ).toEqual({
      givenName: 'Hana',
      familyName: 'Bekele',
      dateOfBirth: '2018-02-28',
    })
  })

  it('rejects a blank name, invalid birth date, and client-provided reference', () => {
    expect(() => CreateStudentSchema.parse({ givenName: '  ' })).toThrow()
    expect(() =>
      CreateStudentSchema.parse({
        givenName: 'Hana',
        dateOfBirth: '2018-02-30',
      }),
    ).toThrow()
    expect(() =>
      CreateStudentSchema.parse({
        givenName: 'Hana',
        studentReference: 'WKA-CLIENT',
      }),
    ).toThrow()
  })

  it('generates non-identifying references from random values', () => {
    const first = generateStudentReference()
    const second = generateStudentReference()
    expect(first).toMatch(/^WKA-[A-F0-9]{20}$/)
    expect(second).toMatch(/^WKA-[A-F0-9]{20}$/)
    expect(first).not.toBe(second)
  })
})
