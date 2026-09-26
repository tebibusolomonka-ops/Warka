import { describe, expect, it } from 'vitest'
import { CsvFormatError, parseCsv } from './csv.js'

describe('CSV parsing', () => {
  it('preserves quoted commas, escaped quotes, and source lines', () => {
    expect(parseCsv('name,detail\r\n"Ada, A","said ""hello"""\r\n')).toEqual([
      { line: 1, cells: ['name', 'detail'] },
      { line: 2, cells: ['Ada, A', 'said "hello"'] },
    ])
  })

  it('rejects an unterminated quoted field', () => {
    expect(() => parseCsv('name\n"unfinished')).toThrow(CsvFormatError)
  })
})
