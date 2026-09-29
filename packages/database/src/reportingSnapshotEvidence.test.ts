import { describe, expect, it } from 'vitest'
import { createReportingSnapshotEvidence } from './reportingSnapshotEvidence.js'

const aggregate = {
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
} as const

describe('reporting snapshot evidence', () => {
  it('has a stable checksum regardless of object key order', () => {
    const first = createReportingSnapshotEvidence(aggregate)
    const reordered = createReportingSnapshotEvidence({
      activity: {
        verification: { unavailable: 0, withdrawn: 0, corrected: 0, active: 0 },
        transfers: { rejected: 0, unresolved: 0, confirmed: 0 },
      },
      academic: {
        outcomes: [],
        publishedResultCount: 0,
        dataState: 'reported',
      },
      enrollment: {
        byGradeLevel: [],
        byAcademicYear: [],
        total: 0,
        dataState: 'reported',
      },
    })
    expect(first).toEqual(reordered)
    expect(first.checksum).toMatch(/^[a-f0-9]{64}$/)
    expect(first.snapshot).not.toBe(aggregate)
  })

  it('rejects private or unapproved fields', () => {
    expect(() =>
      createReportingSnapshotEvidence({
        ...aggregate,
        studentName: 'Private',
      }),
    ).toThrow()
    expect(() =>
      createReportingSnapshotEvidence({
        ...aggregate,
        enrollment: { ...aggregate.enrollment, studentReference: 'Private' },
      }),
    ).toThrow()
  })
})
