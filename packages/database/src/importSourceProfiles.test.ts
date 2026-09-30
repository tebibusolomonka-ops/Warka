import { describe, expect, it } from 'vitest'
import { ImportSourceProfileInputSchema } from './importSourceProfiles.js'

describe('import source profiles', () => {
  const base = {
    name: 'District SIS',
    schoolId: '123e4567-e89b-42d3-a456-426614174001',
    format: 'csv',
    entityType: 'student',
    mapping: {
      version: 1,
      columns: [{ sourceColumn: 'First Name', targetField: 'givenName' }],
    },
  }
  it('accepts structured CSV and XLSX mappings', () => {
    expect(ImportSourceProfileInputSchema.parse(base).format).toBe('csv')
    expect(
      ImportSourceProfileInputSchema.parse({ ...base, format: 'xlsx' }).format,
    ).toBe('xlsx')
  })
  it('requires exactly one scope and rejects executable mapping content', () => {
    expect(() =>
      ImportSourceProfileInputSchema.parse({
        ...base,
        organizationId: '123e4567-e89b-42d3-a456-426614174002',
      }),
    ).toThrow()
    expect(() =>
      ImportSourceProfileInputSchema.parse({
        ...base,
        mapping: { version: 1, columns: [], sql: 'DROP TABLE Student' },
      }),
    ).toThrow()
  })
})
