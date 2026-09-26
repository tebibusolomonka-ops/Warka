import { describe, expect, it, vi } from 'vitest'
import {
  CreateReportingPeriodSchema,
  removeRequiredSchool,
  ReportingRequirementStateError,
} from './reportingPeriods.js'

describe('reporting periods', () => {
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
