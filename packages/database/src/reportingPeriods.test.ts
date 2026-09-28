import { describe, expect, it, vi } from 'vitest'
import {
  CreateReportingPeriodSchema,
  removeRequiredSchool,
  ReportingRequirementStateError,
  reportingWindowState,
} from './reportingPeriods.js'

describe('reporting periods', () => {
  it('validates submission window order and does not call a school late before due time', () => {
    const input = {
      organizationId: '813787ea-6f4f-4b17-bbed-9b0901f3379c',
      name: 'Term summary',
      startsOn: '2026-01-01',
      endsOn: '2026-06-30',
      submissionDueOn: '2026-07-10',
      opensAt: '2026-07-01T09:00:00Z',
      dueAt: '2026-07-10T17:00:00Z',
      closesAt: '2026-07-15T17:00:00Z',
    }
    expect(CreateReportingPeriodSchema.safeParse(input).success).toBe(true)
    expect(
      CreateReportingPeriodSchema.safeParse({
        ...input,
        dueAt: '2026-06-30T09:00:00Z',
      }).success,
    ).toBe(false)
    expect(
      CreateReportingPeriodSchema.safeParse({
        ...input,
        closesAt: '2026-07-09T09:00:00Z',
      }).success,
    ).toBe(false)
    const period = {
      opensAt: new Date(input.opensAt),
      dueAt: new Date(input.dueAt),
      closesAt: new Date(input.closesAt),
      submissionDueOn: new Date(input.submissionDueOn),
    }
    expect(reportingWindowState(period, new Date('2026-06-30T10:00:00Z'))).toBe(
      'notOpen',
    )
    expect(reportingWindowState(period, new Date('2026-07-08T10:00:00Z'))).toBe(
      'open',
    )
    expect(reportingWindowState(period, new Date('2026-07-11T10:00:00Z'))).toBe(
      'pastDue',
    )
    expect(reportingWindowState(period, new Date('2026-07-16T10:00:00Z'))).toBe(
      'closed',
    )
  })
  it('requires ordered dates and a due date after the reporting window', () => {
    expect(
      CreateReportingPeriodSchema.safeParse({
        organizationId: '813787ea-6f4f-4b17-bbed-9b0901f3379c',
        name: 'Term summary',
        startsOn: '2026-01-01',
        endsOn: '2026-06-30',
        submissionDueOn: '2026-07-10',
      }).success,
    ).toBe(true)
    expect(
      CreateReportingPeriodSchema.safeParse({
        organizationId: '813787ea-6f4f-4b17-bbed-9b0901f3379c',
        name: 'Invalid',
        startsOn: '2026-06-30',
        endsOn: '2026-01-01',
        submissionDueOn: '2026-01-02',
      }).success,
    ).toBe(false)
  })

  it('preserves a required school after report history exists', async () => {
    const database = {
      reportingPeriod: {
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValue({ organizationId: 'scope' }),
      },
      bureauAccess: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ role: 'reportManager', revokedAt: null }),
      },
      reportingSubmission: {
        findUnique: vi.fn().mockResolvedValue({ status: 'submitted' }),
      },
      reportingRequirement: { delete: vi.fn() },
    }
    await expect(
      removeRequiredSchool(database as never, 'manager', 'period', 'school'),
    ).rejects.toBeInstanceOf(ReportingRequirementStateError)
    expect(database.reportingRequirement.delete).not.toHaveBeenCalled()
  })
})
