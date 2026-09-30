import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { parseSpreadsheetImport, XLSX_LIMITS } from './spreadsheetImports.js'

const asset = {
  contentType:
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  sizeBytes: 100,
  status: 'available',
  scanStatus: 'clean',
}
async function workbookBuffer(configure: (workbook: ExcelJS.Workbook) => void) {
  const workbook = new ExcelJS.Workbook()
  configure(workbook)
  return Buffer.from(await workbook.xlsx.writeBuffer())
}

describe('spreadsheet import parsing', () => {
  it('reads a selected valid sheet', async () => {
    const buffer = await workbookBuffer((book) => {
      book.addWorksheet('Students').addRow(['name', 'Hana'])
    })
    await expect(
      parseSpreadsheetImport(
        buffer,
        { ...asset, sizeBytes: buffer.length },
        'Students',
      ),
    ).resolves.toMatchObject({
      sheetName: 'Students',
      rows: [['name', 'Hana']],
    })
  })
  it.each([
    ['malformed workbook', Buffer.from('not-xlsx'), asset, undefined],
    [
      'oversized workbook',
      Buffer.alloc(XLSX_LIMITS.fileBytes + 1),
      { ...asset, sizeBytes: XLSX_LIMITS.fileBytes },
      undefined,
    ],
    [
      'unsupported file type',
      Buffer.from('x'),
      { ...asset, contentType: 'text/csv' },
      undefined,
    ],
    [
      'unclean file',
      Buffer.from('x'),
      { ...asset, scanStatus: 'pending' },
      undefined,
    ],
  ])('rejects %s', async (_name, buffer, metadata, sheet) => {
    await expect(
      parseSpreadsheetImport(buffer, metadata, sheet),
    ).rejects.toThrow()
  })
  it('rejects unexpected sheets, formulas, and resource limits', async () => {
    const normal = await workbookBuffer((book) =>
      book.addWorksheet('Students').addRow(['x']),
    )
    await expect(
      parseSpreadsheetImport(
        normal,
        { ...asset, sizeBytes: normal.length },
        'Other',
      ),
    ).rejects.toThrow('does not exist')
    const formula = await workbookBuffer((book) => {
      book.addWorksheet('Students').getCell('A1').value = {
        formula: '1+1',
        result: 2,
      }
    })
    await expect(
      parseSpreadsheetImport(formula, { ...asset, sizeBytes: formula.length }),
    ).rejects.toThrow('Formula')
    const rows = await workbookBuffer((book) => {
      const sheet = book.addWorksheet('Rows')
      for (let i = 0; i <= XLSX_LIMITS.rows; i += 1) sheet.addRow(['x'])
    })
    await expect(
      parseSpreadsheetImport(rows, { ...asset, sizeBytes: rows.length }),
    ).rejects.toThrow('row limit')
    const columns = await workbookBuffer((book) =>
      book
        .addWorksheet('Columns')
        .addRow(Array(XLSX_LIMITS.columns + 1).fill('x')),
    )
    await expect(
      parseSpreadsheetImport(columns, { ...asset, sizeBytes: columns.length }),
    ).rejects.toThrow('column limit')
  })
})
