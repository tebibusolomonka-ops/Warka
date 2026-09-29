import { randomUUID } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import {
  ReportingSubmissionError,
  submitSchoolReport,
} from './reportingSubmissions.js'

function submissionStore(role: string | null = 'administrator') {
  const auditCreate = vi.fn().mockResolvedValue({ id: randomUUID() })
  const submission = {
    id: randomUUID(),
    schoolId: randomUUID(),
    reportingPeriodId: randomUUID(),
    currentVersion: 1,
    submittedAt: new Date(),
    snapshot: {
      enrollment: {
        dataState: 'reported',
        total: 0,
        byAcademicYear: [],
        byGradeLevel: [],
      },
      academic: {
        dataState: 'reported',
        publishedResultCount: 0,
        outcomes: [],
      },
      activity: {
        transfers: { confirmed: 0, unresolved: 0, rejected: 0 },
        verification: { active: 0, corrected: 0, withdrawn: 0, unavailable: 0 },
      },
    },
  }
  const transaction = {
    auditEvent: { create: auditCreate },
    reportingRequirement: {
      findUnique: vi.fn().mockResolvedValue({
        reportingPeriod: {
          status: 'open',
          opensAt: null,
          dueAt: null,
          closesAt: null,
          submissionDueOn: new Date('2099-01-01'),
        },
      }),
    },
    dataQualityIssue: { findMany: vi.fn().mockResolvedValue([]) },
    reportingPeriod: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        id: submission.reportingPeriodId,
        organizationId: randomUUID(),
        status: 'open',
      }),
    },
    reportingSubmission: {
      findUnique: vi.fn().mockResolvedValue(submission),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: vi.fn().mockResolvedValue(submission),
    },
    reportingSubmissionVersion: { create: vi.fn().mockResolvedValue({}) },
    bureauAccess: { findMany: vi.fn().mockResolvedValue([]) },
    notification: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
  }
  return {
    auditCreate,
    submission,
    store: {
      schoolMembership: {
        findUnique: vi.fn().mockResolvedValue(role ? { role } : null),
      },
      $transaction: vi.fn(async (work) => work(transaction)),
    },
  }
}

describe('privileged operation auditing', () => {
  it('attributes a successful report submission to the authenticated actor', async () => {
    const fixture = submissionStore()
    const actorUserId = randomUUID()
    await submitSchoolReport(
      fixture.store as never,
      actorUserId,
      fixture.submission.reportingPeriodId,
      fixture.submission.schoolId,
    )
    expect(fixture.auditCreate).toHaveBeenCalledOnce()
    expect(fixture.auditCreate.mock.calls[0]?.[0]?.data).toMatchObject({
      actorUserId,
      action: 'report.submitted',
      resourceType: 'reportingSubmission',
      resourceId: fixture.submission.id,
      schoolId: fixture.submission.schoolId,
    })
    expect(JSON.stringify(fixture.auditCreate.mock.calls[0])).not.toMatch(
      /password|credential|token|cookie|secret/i,
    )
  })

  it('does not record a success event when permission fails', async () => {
    const fixture = submissionStore('teacher')
    await expect(
      submitSchoolReport(
        fixture.store as never,
        randomUUID(),
        fixture.submission.reportingPeriodId,
        fixture.submission.schoolId,
      ),
    ).rejects.toBeInstanceOf(ReportingSubmissionError)
    expect(fixture.store.$transaction).not.toHaveBeenCalled()
    expect(fixture.auditCreate).not.toHaveBeenCalled()
  })

  it('denies a submission from a user without membership in that school', async () => {
    const fixture = submissionStore(null)
    await expect(
      submitSchoolReport(
        fixture.store as never,
        randomUUID(),
        fixture.submission.reportingPeriodId,
        fixture.submission.schoolId,
      ),
    ).rejects.toThrow('School reporting permission denied')
    expect(fixture.auditCreate).not.toHaveBeenCalled()
  })
})
