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
  }
  const transaction = {
    auditEvent: { create: auditCreate },
    reportingPeriod: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        id: submission.reportingPeriodId,
        organizationId: randomUUID(),
        status: 'open',
      }),
    },
    reportingSubmission: {
      update: vi.fn().mockResolvedValue(submission),
    },
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
