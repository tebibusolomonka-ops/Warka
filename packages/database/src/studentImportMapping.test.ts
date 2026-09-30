import { describe, expect, it } from 'vitest'
import {
  previewStudentColumnMapping,
  StudentColumnMappingSchema,
} from './studentImportMapping.js'
describe('student import column mapping', () => {
  const mapping = [
    { sourceColumn: 'First', targetField: 'givenName' },
    { sourceColumn: 'Grade', targetField: 'grade' },
  ] as const
  it('previews only approved targets without writing records', () => {
    expect(
      previewStudentColumnMapping(
        ['First', 'Grade'],
        [[' Hana ', '7']],
        mapping,
      ),
    ).toEqual([
      {
        sourceColumn: 'First',
        targetField: 'givenName',
        state: 'mapped',
        sample: [' Hana '],
      },
      {
        sourceColumn: 'Grade',
        targetField: 'grade',
        state: 'mapped',
        sample: ['7'],
      },
    ])
  })
  it('rejects arbitrary fields, unknown columns, duplicates, and missing required mappings', () => {
    expect(() =>
      StudentColumnMappingSchema.parse([
        { sourceColumn: 'SQL', targetField: 'passwordHash' },
      ]),
    ).toThrow()
    expect(() => previewStudentColumnMapping(['First'], [], mapping)).toThrow(
      'unknown',
    )
    expect(() =>
      StudentColumnMappingSchema.parse([mapping[0], mapping[0], mapping[1]]),
    ).toThrow('only once')
    expect(() => StudentColumnMappingSchema.parse([mapping[0]])).toThrow(
      'grade',
    )
  })
})
