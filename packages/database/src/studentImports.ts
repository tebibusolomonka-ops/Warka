import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { CsvFormatError, parseCsv } from './csv.js'
import {
  getImportJob,
  ImportStateError,
  NormalizedStudentImportRowSchema,
  recordImportValidation,
  type NormalizedStudentImportRow,
} from './importJobs.js'
import { findPossibleDuplicates } from './studentRegistration.js'

const requiredHeaders = ['givenName', 'academicYearId', 'gradeLevelId'] as const
const allowedHeaders = [
  ...requiredHeaders,
  'familyName',
  'dateOfBirth',
  'schoolClassId',
  'guardianName',
  'guardianPhone',
  'guardianEmail',
  'guardianRelationship',
] as const

type Issue = {
  rowNumber: number
  severity: 'error' | 'warning'
  code: string
  message: string
}

function issue(
  rowNumber: number,
  severity: Issue['severity'],
  code: string,
  message: string,
): Issue {
  return { rowNumber, severity, code, message }
}

export async function validateStudentImport(
  database: PrismaClient,
  actorUserId: string,
  schoolId: string,
  jobId: string,
  csv: string,
) {
  const job = await getImportJob(database, actorUserId, schoolId, jobId)
  if (!['uploaded', 'validated', 'invalid'].includes(job.status))
    throw new ImportStateError()
  if (Buffer.byteLength(csv, 'utf8') > 1_000_000)
    return recordImportValidation(database, actorUserId, schoolId, jobId, {
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      issues: [issue(1, 'error', 'fileTooLarge', 'CSV exceeds the size limit')],
    })

  let parsed: ReturnType<typeof parseCsv>
  try {
    parsed = parseCsv(csv.replace(/^\uFEFF/, ''))
  } catch (error) {
    if (!(error instanceof CsvFormatError)) throw error
    return recordImportValidation(database, actorUserId, schoolId, jobId, {
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      issues: [issue(error.line, 'error', 'malformedCsv', 'CSV is malformed')],
    })
  }
  if (!parsed.length)
    return recordImportValidation(database, actorUserId, schoolId, jobId, {
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      issues: [issue(1, 'error', 'emptyImport', 'CSV has no header row')],
    })
  const headers = parsed[0]!.cells.map((cell) => cell.trim())
  const missing = requiredHeaders.filter((header) => !headers.includes(header))
  if (
    missing.length ||
    new Set(headers).size !== headers.length ||
    headers.some((header) => !allowedHeaders.includes(header as never))
  )
    return recordImportValidation(database, actorUserId, schoolId, jobId, {
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      issues: [
        issue(
          1,
          'error',
          'invalidHeader',
          'CSV headers must match the student import template',
        ),
      ],
    })
  const dataRows = parsed.slice(1)
  if (!dataRows.length)
    return recordImportValidation(database, actorUserId, schoolId, jobId, {
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      issues: [issue(1, 'error', 'emptyImport', 'CSV has no student rows')],
    })
  if (dataRows.length > 500)
    return recordImportValidation(database, actorUserId, schoolId, jobId, {
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      issues: [issue(1, 'error', 'tooManyRows', 'CSV exceeds 500 rows')],
    })
  const [years, grades, classes] = await Promise.all([
    database.academicYear.findMany({
      where: { schoolId },
      select: { id: true },
    }),
    database.gradeLevel.findMany({
      where: { schoolId },
      select: { id: true },
    }),
    database.schoolClass.findMany({
      where: { schoolId },
      select: { id: true, academicYearId: true, gradeLevelId: true },
    }),
  ])
  const yearIds = new Set(years.map((year) => year.id))
  const gradeIds = new Set(grades.map((grade) => grade.id))
  const classById = new Map(
    classes.map((schoolClass) => [schoolClass.id, schoolClass]),
  )
  const issues: Issue[] = []
  const normalizedRows: NormalizedStudentImportRow[] = []
  const seenRows = new Set<string>()
  let invalidRows = 0
  for (const csvRow of dataRows) {
    const rowIssues: Issue[] = []
    if (csvRow.cells.length !== headers.length) {
      rowIssues.push(
        issue(
          csvRow.line,
          'error',
          'invalidColumns',
          'Row column count is invalid',
        ),
      )
    } else {
      const values = Object.fromEntries(
        headers.map((header, index) => [
          header,
          csvRow.cells[index]?.trim() ?? '',
        ]),
      )
      const candidate = Object.fromEntries(
        Object.entries(values).filter(([, value]) => value !== ''),
      )
      const parsedRow = NormalizedStudentImportRowSchema.safeParse({
        rowNumber: csvRow.line,
        ...candidate,
      })
      if (!parsedRow.success)
        rowIssues.push(
          issue(
            csvRow.line,
            'error',
            'invalidFields',
            'Row has invalid student or guardian fields',
          ),
        )
      else {
        const row = parsedRow.data
        if (!yearIds.has(row.academicYearId) || !gradeIds.has(row.gradeLevelId))
          rowIssues.push(
            issue(
              csvRow.line,
              'error',
              'invalidStructure',
              'Academic structure is outside this school',
            ),
          )
        if (row.schoolClassId) {
          const schoolClass = classById.get(row.schoolClassId)
          if (
            !schoolClass ||
            schoolClass.academicYearId !== row.academicYearId ||
            schoolClass.gradeLevelId !== row.gradeLevelId
          )
            rowIssues.push(
              issue(
                csvRow.line,
                'error',
                'invalidClass',
                'Class must match the school, year, and grade',
              ),
            )
        }
        if (
          (row.guardianPhone ||
            row.guardianEmail ||
            row.guardianRelationship) &&
          !row.guardianName
        )
          rowIssues.push(
            issue(
              csvRow.line,
              'error',
              'guardianNameRequired',
              'Guardian name is required with guardian details',
            ),
          )
        if (row.guardianName && !row.guardianRelationship)
          rowIssues.push(
            issue(
              csvRow.line,
              'error',
              'relationshipRequired',
              'Guardian relationship is required',
            ),
          )
        const identity = JSON.stringify([
          row.givenName.normalize('NFKC').toLowerCase(),
          row.familyName?.normalize('NFKC').toLowerCase() ?? '',
          row.dateOfBirth ?? JSON.stringify(csvRow.cells),
          row.academicYearId,
        ])
        if (seenRows.has(identity))
          rowIssues.push(
            issue(
              csvRow.line,
              'error',
              'duplicateCsvRow',
              'Possible repeated student row in CSV',
            ),
          )
        seenRows.add(identity)
        if (!rowIssues.some((item) => item.severity === 'error')) {
          if (row.dateOfBirth) {
            const possible = await findPossibleDuplicates(database, schoolId, {
              givenName: row.givenName,
              ...(row.familyName ? { familyName: row.familyName } : {}),
              dateOfBirth: row.dateOfBirth,
            })
            if (possible.length)
              rowIssues.push(
                issue(
                  csvRow.line,
                  'warning',
                  'possibleDuplicate',
                  'Possible existing student requires review',
                ),
              )
          }
          normalizedRows.push(row)
        }
      }
    }
    if (rowIssues.some((item) => item.severity === 'error')) invalidRows += 1
    issues.push(...rowIssues)
  }
  return recordImportValidation(database, actorUserId, schoolId, jobId, {
    totalRows: dataRows.length,
    validRows: normalizedRows.length,
    invalidRows,
    issues,
    normalizedRows,
  })
}

export function readValidatedStudentRows(value: unknown) {
  return z.array(NormalizedStudentImportRowSchema).max(500).parse(value)
}
