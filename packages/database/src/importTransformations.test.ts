import { describe, expect, it } from 'vitest'
import {
  ImportTransformationConfigSchema,
  previewImportTransformations,
} from './importTransformations.js'
describe('import transformations', () => {
  it('applies deterministic bounded rules and returns before/after', () => {
    expect(
      previewImportTransformations(
        { name: ' Hana ', dob: '31/12/2014', active: 'Y', grade: '07' },
        [
          { kind: 'trim', field: 'name' },
          { kind: 'date', field: 'dob', order: 'dmy' },
          { kind: 'yesNo', field: 'active', yes: ['Y'], no: ['N'] },
          { kind: 'enumMap', field: 'grade', values: { '07': '7' } },
        ],
      ),
    ).toEqual({
      before: { name: ' Hana ', dob: '31/12/2014', active: 'Y', grade: '07' },
      after: { name: 'Hana', dob: '2014-12-31', active: 'yes', grade: '7' },
    })
  })
  it('rejects executable and unknown rule kinds', () => {
    expect(() =>
      ImportTransformationConfigSchema.parse([
        { kind: 'javascript', code: 'fetch("x")' },
      ]),
    ).toThrow()
    expect(() =>
      ImportTransformationConfigSchema.parse([
        { kind: 'regex', pattern: '(a+)+$' },
      ]),
    ).toThrow()
  })
})
