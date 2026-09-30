import ExcelJS from 'exceljs'
import { z } from 'zod'

export const XLSX_LIMITS = {
  fileBytes: 5 * 1024 * 1024,
  sheets: 5,
  rows: 1000,
  columns: 100,
  cellCharacters: 2000,
} as const
export class SpreadsheetImportError extends Error {}

const AssetSchema = z.strictObject({
  contentType: z.literal(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ),
  sizeBytes: z.number().int().nonnegative().max(XLSX_LIMITS.fileBytes),
  status: z.literal('available'),
  scanStatus: z.literal('clean'),
})

export async function parseSpreadsheetImport(
  buffer: Buffer,
  asset: unknown,
  sheetName?: string,
) {
  AssetSchema.parse(asset)
  if (buffer.byteLength > XLSX_LIMITS.fileBytes)
    throw new SpreadsheetImportError('Spreadsheet exceeds file size limit')
  const workbook = new ExcelJS.Workbook()
  try {
    await workbook.xlsx.load(buffer as never)
  } catch {
    throw new SpreadsheetImportError('Malformed XLSX workbook')
  }
  if (workbook.worksheets.length > XLSX_LIMITS.sheets)
    throw new SpreadsheetImportError('Spreadsheet exceeds sheet limit')
  const worksheet = sheetName
    ? workbook.getWorksheet(sheetName)
    : workbook.worksheets[0]
  if (!worksheet || (sheetName && worksheet.name !== sheetName))
    throw new SpreadsheetImportError('Requested sheet does not exist')
  if (worksheet.rowCount > XLSX_LIMITS.rows)
    throw new SpreadsheetImportError('Spreadsheet exceeds row limit')
  if (worksheet.columnCount > XLSX_LIMITS.columns)
    throw new SpreadsheetImportError('Spreadsheet exceeds column limit')
  const rows: Array<Array<string | number | boolean | null>> = []
  worksheet.eachRow({ includeEmpty: true }, (row) => {
    const values: Array<string | number | boolean | null> = []
    for (let column = 1; column <= worksheet.columnCount; column += 1) {
      const value = row.getCell(column).value
      if (value && typeof value === 'object' && 'formula' in value)
        throw new SpreadsheetImportError('Formula cells are not supported')
      const normalized =
        value instanceof Date
          ? value.toISOString()
          : value == null
            ? null
            : typeof value === 'object'
              ? JSON.stringify(value)
              : value
      if (String(normalized ?? '').length > XLSX_LIMITS.cellCharacters)
        throw new SpreadsheetImportError(
          'Spreadsheet cell exceeds length limit',
        )
      values.push(normalized as string | number | boolean | null)
    }
    rows.push(values)
  })
  return { sheetName: worksheet.name, rows }
}
