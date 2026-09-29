import type { PrismaClient } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'
import {
  buildReportingExportRows,
  createReportingExport,
} from './reportingExports.js'
import { serializeCsv } from './schoolExports.js'

const schoolId = '70033397-6395-4446-9240-b1f776b7b83c'
const snapshot = {
  enrollment: {
    dataState: 'reported',
    total: 2,
    byAcademicYear: [],
    byGradeLevel: [],
  },
  academic: { dataState: 'reported', publishedResultCount: 0, outcomes: [] },
  activity: {
    transfers: { confirmed: 1, unresolved: 0, rejected: 0 },
    verification: { active: 0, corrected: 0, withdrawn: 0, unavailable: 0 },
  },
}
const schools = [
  {
    id: schoolId,
    name: '=Formula School',
    submission: {
      status: 'approved',
      acceptedVersion: 2,
      versions: [
        {
          version: 1,
          snapshot: {
            ...snapshot,
            enrollment: { ...snapshot.enrollment, total: 99 },
          },
          submittedAt: new Date('2026-01-01'),
        },
        { version: 2, snapshot, submittedAt: new Date('2026-02-01') },
      ],
    },
  },
]

describe('bureau reporting exports', () => {
  it('uses accepted aggregate version and protects CSV cells', () => {
    const rows = buildReportingExportRows('Annual', schools, 'enrollment')
    const csv = serializeCsv(rows)
    expect(csv).toContain('"2"')
    expect(csv).not.toContain('"99"')
    expect(csv).toContain("'=Formula School")
    expect(csv).not.toContain('studentReference')
  })

  it('keeps missing schools and unreported values distinct from zero', () => {
    const coverage = buildReportingExportRows(
      'Annual',
      [{ id: schoolId, name: 'Missing', submission: null }],
      'coverage',
    )
    expect(coverage[1]).toContain('missing')
    expect(coverage[1]).toContain('notReported')
    expect(coverage[1]).not.toContain(0)
  })

  it('requires bureau scope and audits authorized export', async () => {
    const organizationId = '64fb7b13-65e3-4fcb-b2cf-23d6059607ca'
    const periodId = 'a263dd33-7a8f-4ef1-949d-ac35a4da5e8b'
    const actorId = '7b8db642-14b5-4953-91c2-71d27d03d011'
    const database = {
      bureauAccess: { findUnique: vi.fn().mockResolvedValue(null) },
      reportingPeriod: {
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValue({ organizationId, name: 'Annual' }),
      },
      reportingRequirement: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ schoolId, school: { name: 'School' } }]),
      },
      reportingSubmission: { findMany: vi.fn().mockResolvedValue([]) },
      auditEvent: { create: vi.fn().mockResolvedValue({}) },
    }
    const client = database as unknown as PrismaClient
    await expect(
      createReportingExport(
        client,
        actorId,
        organizationId,
        periodId,
        'coverage',
      ),
    ).rejects.toThrow('Bureau reporting access denied')
    expect(database.reportingRequirement.findMany).not.toHaveBeenCalled()
    database.bureauAccess.findUnique.mockResolvedValue({
      role: 'viewer',
      revokedAt: null,
    })
    const result = await createReportingExport(
      client,
      actorId,
      organizationId,
      periodId,
      'coverage',
    )
    expect(result.csv).toContain('notReported')
    expect(database.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'report.exported' }),
      }),
    )
  })
})
