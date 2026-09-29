import { describe, expect, it } from 'vitest'
import { createReportingSnapshotEvidence } from './reportingSnapshotEvidence.js'
import { validateRegionalReporting } from './regionalReportingValidation.js'

const periodId = 'f61512b5-e4a9-4dd6-954c-27d729befbaa'
const schoolId = 'f6b76afd-0d86-46bc-b29c-9ffbd70d3192'
const otherSchoolId = '445bc9bd-64ef-4b59-82c4-2a4deaa3b6e9'
const snapshot = {
  enrollment: {
    dataState: 'reported',
    total: 0,
    byAcademicYear: [],
    byGradeLevel: [],
  },
  academic: { dataState: 'reported', publishedResultCount: 0, outcomes: [] },
  activity: {
    transfers: { confirmed: 0, unresolved: 0, rejected: 0 },
    verification: { active: 0, corrected: 0, withdrawn: 0, unavailable: 0 },
  },
}

describe('regional reporting validation', () => {
  it('checks required coverage and accepted version evidence without scoring schools', () => {
    const checksum = createReportingSnapshotEvidence(snapshot).checksum
    const result = validateRegionalReporting(
      periodId,
      [schoolId, otherSchoolId],
      [
        {
          schoolId,
          reportingPeriodId: periodId,
          status: 'approved',
          currentVersion: 2,
          acceptedVersion: 2,
          versions: [
            {
              version: 1,
              snapshot: { enrollment: { dataState: 'unknown' } },
              snapshotChecksum: null,
            },
            { version: 2, snapshot, snapshotChecksum: checksum },
          ],
        },
      ],
    )
    expect(result.blocking).toEqual([])
    expect(result.warnings).toContainEqual({
      schoolId: otherSchoolId,
      code: 'REPORTING_REQUIRED_SCHOOL_MISSING',
      severity: 'warning',
    })
    expect(result).not.toHaveProperty('score')
  })

  it('flags inconsistent and duplicate aggregates as factual issues', () => {
    const submission = {
      schoolId,
      reportingPeriodId: periodId,
      status: 'submitted',
      currentVersion: 1,
      acceptedVersion: null,
      versions: [
        {
          version: 1,
          snapshot: {
            ...snapshot,
            enrollment: { ...snapshot.enrollment, total: 1 },
          },
          snapshotChecksum: null,
        },
      ],
    }
    const result = validateRegionalReporting(
      periodId,
      [schoolId],
      [submission, submission],
    )
    expect(result.blocking.map((issue) => issue.code)).toContain(
      'REPORTING_ENROLLMENT_YEAR_TOTAL_MISMATCH',
    )
    expect(result.blocking.map((issue) => issue.code)).toContain(
      'REPORTING_DUPLICATE_SCHOOL_SUBMISSION',
    )
  })
})
