import { Prisma, type PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { findAssessmentById } from './assessments.js'
import { assertResultSetDraft } from './results.js'
import {
  canRecordAssessment,
  InvalidMarkContextError,
  MarkPermissionError,
} from './marks.js'

export type ImportProblemCode =
  | 'EMPTY_IMPORT'
  | 'MALFORMED_CSV'
  | 'MISSING_HEADER'
  | 'TOO_MANY_ROWS'
  | 'DUPLICATE_STUDENT'
  | 'UNKNOWN_STUDENT'
  | 'OUTSIDE_CLASS'
  | 'INVALID_SCORE'
  | 'SCORE_EXCEEDS_MAXIMUM'
  | 'CONCURRENT_CHANGE'

export type ImportProblem = {
  line: number
  code: ImportProblemCode
  studentReference?: string
}

export type ImportRow = {
  line: number
  studentReference: string
  score: string
  studentId: string
  enrollmentId: string
  action: 'create' | 'update'
}

export type ImportReview = {
  valid: boolean
  rows: ImportRow[]
  problems: ImportProblem[]
}

export class InvalidMarkImportError extends Error {
  constructor(readonly problems: ImportProblem[]) {
    super('Mark import must be reviewed and contain no invalid rows')
  }
}

type CsvRow = { line: number; cells: string[] }

function parseCsv(csv: string): CsvRow[] {
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
        throw new InvalidMarkImportError([
          { line: rowLine, code: 'MALFORMED_CSV' },
        ])
      }
    } else if (char === ',' && !quoted) {
      cells.push(cell)
      cell = ''
      closedQuote = false
    } else if ((char === '\n' || char === '\r') && !quoted) {
      cells.push(cell)
      if (cells.some((value) => value.trim() !== '')) {
        rows.push({ line: rowLine, cells })
      }
      cells = []
      cell = ''
      closedQuote = false
      if (char === '\r' && csv[index + 1] === '\n') index += 1
      line += 1
      rowLine = line
    } else {
      if (closedQuote) {
        throw new InvalidMarkImportError([
          { line: rowLine, code: 'MALFORMED_CSV' },
        ])
      }
      cell += char
      if (char === '\n') line += 1
    }
  }
  if (quoted) {
    throw new InvalidMarkImportError([{ line: rowLine, code: 'MALFORMED_CSV' }])
  }
  cells.push(cell)
  if (cells.some((value) => value.trim() !== '')) {
    rows.push({ line: rowLine, cells })
  }
  return rows
}

export async function validateMarkImport(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  assessmentId: string,
  csv: string,
): Promise<ImportReview> {
  z.uuid().parse(actorId)
  z.uuid().parse(schoolId)
  z.uuid().parse(assessmentId)
  if (csv.length > 1_000_000) {
    return {
      valid: false,
      rows: [],
      problems: [{ line: 0, code: 'TOO_MANY_ROWS' }],
    }
  }
  const assessment = await findAssessmentById(database, schoolId, assessmentId)
  if (!assessment) throw new InvalidMarkContextError()
  if (!(await canRecordAssessment(database, actorId, assessment))) {
    throw new MarkPermissionError()
  }
  await assertResultSetDraft(database, assessment)
  let csvRows: CsvRow[]
  try {
    csvRows = parseCsv(csv.replace(/^\uFEFF/, ''))
  } catch (error) {
    if (error instanceof InvalidMarkImportError) {
      return { valid: false, rows: [], problems: error.problems }
    }
    throw error
  }
  if (csvRows.length === 0) {
    return {
      valid: false,
      rows: [],
      problems: [{ line: 1, code: 'EMPTY_IMPORT' }],
    }
  }
  if (csvRows.length > 2001) {
    return {
      valid: false,
      rows: [],
      problems: [{ line: 0, code: 'TOO_MANY_ROWS' }],
    }
  }
  const headers = csvRows[0]!.cells.map((value) => value.trim().toLowerCase())
  const referenceIndex = headers.indexOf('studentreference')
  const scoreIndex = headers.indexOf('score')
  if (referenceIndex < 0 || scoreIndex < 0) {
    return {
      valid: false,
      rows: [],
      problems: [{ line: csvRows[0]!.line, code: 'MISSING_HEADER' }],
    }
  }
  const problems: ImportProblem[] = []
  const rows: ImportRow[] = []
  const seen = new Set<string>()
  for (const row of csvRows.slice(1)) {
    const studentReference = (row.cells[referenceIndex] ?? '')
      .trim()
      .toUpperCase()
    const rawScore = (row.cells[scoreIndex] ?? '').trim()
    const before = problems.length
    if (!studentReference || seen.has(studentReference)) {
      problems.push({
        line: row.line,
        code: 'DUPLICATE_STUDENT',
        ...(studentReference ? { studentReference } : {}),
      })
    }
    seen.add(studentReference)
    let score: Prisma.Decimal | null = null
    if (!/^\d{1,6}(\.\d{1,2})?$/.test(rawScore)) {
      problems.push({ line: row.line, code: 'INVALID_SCORE', studentReference })
    } else {
      score = new Prisma.Decimal(rawScore)
      if (score.gt(assessment.maximumScore)) {
        problems.push({
          line: row.line,
          code: 'SCORE_EXCEEDS_MAXIMUM',
          studentReference,
        })
      }
    }
    const student = studentReference
      ? await database.student.findUnique({
          where: { studentReference },
          select: { id: true },
        })
      : null
    if (!student) {
      problems.push({
        line: row.line,
        code: 'UNKNOWN_STUDENT',
        studentReference,
      })
    }
    const enrollment = student
      ? await database.enrollment.findFirst({
          where: {
            studentId: student.id,
            schoolId,
            academicYearId: assessment.academicYearId,
          },
          select: { id: true, schoolClassId: true, status: true },
        })
      : null
    if (
      student &&
      (!enrollment ||
        enrollment.schoolClassId !== assessment.schoolClassId ||
        enrollment.status !== 'approved')
    ) {
      problems.push({ line: row.line, code: 'OUTSIDE_CLASS', studentReference })
    }
    if (problems.length !== before || !student || !enrollment || !score)
      continue
    const existing = await database.mark.findUnique({
      where: {
        enrollmentId_assessmentId: {
          enrollmentId: enrollment.id,
          assessmentId,
        },
      },
      select: { id: true },
    })
    rows.push({
      line: row.line,
      studentReference,
      score: score.toFixed(2),
      studentId: student.id,
      enrollmentId: enrollment.id,
      action: existing ? 'update' : 'create',
    })
  }
  if (csvRows.length === 1) problems.push({ line: 1, code: 'EMPTY_IMPORT' })
  return { valid: problems.length === 0, rows, problems }
}

export async function applyMarkImport(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  assessmentId: string,
  csv: string,
): Promise<{ created: number; updated: number }> {
  try {
    return await database.$transaction(async (transaction) => {
      const review = await validateMarkImport(
        transaction as PrismaClient,
        actorId,
        schoolId,
        assessmentId,
        csv,
      )
      if (!review.valid) throw new InvalidMarkImportError(review.problems)
      let created = 0
      let updated = 0
      for (const row of review.rows) {
        if (row.action === 'create') {
          await transaction.mark.create({
            data: {
              schoolId,
              studentId: row.studentId,
              enrollmentId: row.enrollmentId,
              assessmentId,
              score: new Prisma.Decimal(row.score),
              recordedById: actorId,
            },
          })
          created += 1
        } else {
          await transaction.mark.update({
            where: {
              enrollmentId_assessmentId: {
                enrollmentId: row.enrollmentId,
                assessmentId,
              },
            },
            data: {
              score: new Prisma.Decimal(row.score),
              recordedById: actorId,
            },
          })
          updated += 1
        }
      }
      return { created, updated }
    })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ['P2002', 'P2025'].includes(error.code)
    ) {
      throw new InvalidMarkImportError([{ line: 0, code: 'CONCURRENT_CHANGE' }])
    }
    throw error
  }
}
