export type CsvRow = { line: number; cells: string[] }

export class CsvFormatError extends Error {
  constructor(readonly line: number) {
    super('Malformed CSV')
  }
}

export function parseCsv(csv: string): CsvRow[] {
  const rows: CsvRow[] = []
  let cells: string[] = []
  let cell = ''
  let quoted = false
  let closedQuote = false
  let line = 1
  let rowLine = 1
  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index]
    if (char === '"') {
      if (quoted && csv[index + 1] === '"') {
        cell += '"'
        index += 1
      } else if (quoted) {
        quoted = false
        closedQuote = true
      } else if (cell.length === 0) {
        quoted = true
      } else {
        throw new CsvFormatError(rowLine)
      }
    } else if (char === ',' && !quoted) {
      cells.push(cell)
      cell = ''
      closedQuote = false
    } else if ((char === '\n' || char === '\r') && !quoted) {
      cells.push(cell)
      if (cells.some((value) => value.trim() !== ''))
        rows.push({ line: rowLine, cells })
      cells = []
      cell = ''
      closedQuote = false
      if (char === '\r' && csv[index + 1] === '\n') index += 1
      line += 1
      rowLine = line
    } else {
      if (closedQuote) throw new CsvFormatError(rowLine)
      cell += char
      if (char === '\n') line += 1
    }
  }
  if (quoted) throw new CsvFormatError(rowLine)
  cells.push(cell)
  if (cells.some((value) => value.trim() !== ''))
    rows.push({ line: rowLine, cells })
  return rows
}
