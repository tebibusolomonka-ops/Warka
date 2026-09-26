import { Prisma, type PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { CsvFormatError, parseCsv, type CsvRow } from './csv.js'
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
    if (error instanceof CsvFormatError) {
      return {
        valid: false,
        rows: [],
        problems: [{ line: error.line, code: 'MALFORMED_CSV' }],
      }
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
