import type { PrismaClient } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'
import {
  evaluateReportingReadiness,
  validateReportingSnapshot,
} from './reportingValidation.js'

const schoolId = '11111111-1111-4111-8111-111111111111'
const periodId = '22222222-2222-4222-8222-222222222222'
const snapshot = {
  enrollment: {
    dataState: 'reported',
    total: 2,
    byAcademicYear: [{ academicYearId: periodId, name: 'Year', count: 2 }],
    byGradeLevel: [{ gradeLevelId: schoolId, name: 'Grade', count: 2 }],
  },
  academic: {
    dataState: 'reported',
    publishedResultCount: 1,
    outcomes: [{ gradeLabel: 'A', count: 1 }],
  },
  activity: {
    transfers: { confirmed: 0, unresolved: 0, rejected: 0 },
    verification: { active: 0, corrected: 0, withdrawn: 0, unavailable: 0 },
  },
}
describe('reporting readiness', () => {
  it('does not convert blanks or unknown states into zero', () => {
    expect(validateReportingSnapshot({}).blocking).toContain(
      'REPORTING_REQUIRED_FIELDS_MISSING',
    )
    expect(
      validateReportingSnapshot({
        ...snapshot,
        enrollment: { dataState: 'unknown' },
      }).blocking,
    ).toContain('REPORTING_ENROLLMENT_NOT_REPORTED')
    expect(
      validateReportingSnapshot({
        ...snapshot,
        academic: { dataState: 'notApplicable' },
      }).blocking,
    ).toContain('REPORTING_ACADEMIC_NOT_REPORTED')
    expect(validateReportingSnapshot(snapshot).ready).toBe(true)
  })
  it('blocks inconsistent aggregate totals and preserves nonblocking warnings', () => {
    expect(
      validateReportingSnapshot({
        ...snapshot,
        enrollment: { ...snapshot.enrollment, total: 3 },
      }).blocking,
    ).toContain('REPORTING_ENROLLMENT_YEAR_TOTAL_MISMATCH')
    expect(
      validateReportingSnapshot({
        ...snapshot,
        activity: {
          ...snapshot.activity,
          transfers: { confirmed: 0, unresolved: 1, rejected: 0 },
        },
      }).warnings,
    ).toContain('REPORTING_TRANSFERS_UNRESOLVED')
  })
  it('checks school eligibility and blocking issues without submitting', async () => {
    const database = {
      reportingRequirement: {
        findUnique: vi.fn().mockResolvedValue({
          reportingPeriod: {
            status: 'open',
            opensAt: null,
            dueAt: null,
            closesAt: null,
            submissionDueOn: new Date('2026-12-31'),
          },
        }),
      },
      reportingSubmission: {
        findUnique: vi.fn().mockResolvedValue({ snapshot }),
      },
      dataQualityIssue: {
        findMany: vi.fn().mockResolvedValue([{ code: 'MARK_OUT_OF_RANGE' }]),
      },
    } as unknown as PrismaClient
    const readiness = await evaluateReportingReadiness(
      database,
      periodId,
      schoolId,
      new Date('2026-09-01'),
    )
    expect(readiness.ready).toBe(false)
    expect(readiness.blocking).toContain('QUALITY:MARK_OUT_OF_RANGE')
    expect(Object.keys(database.reportingSubmission)).toEqual(['findUnique'])
  })
})
