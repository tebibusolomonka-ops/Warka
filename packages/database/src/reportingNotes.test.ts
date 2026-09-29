import type { PrismaClient } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'
import {
  addBureauReportingNote,
  addSchoolReportingNote,
  listBureauReportingNotes,
  listSchoolReportingNotes,
} from './reportingNotes.js'

const actor = 'e16f846d-0527-47f3-b1cd-38b26949901a'
const schoolId = '748d0d4b-57bf-48ee-9b3e-cbe7b69e688a'
const periodId = 'cc2cf6dc-b8aa-43de-b4f2-a801de21dc26'
const organizationId = '98a4a246-f01f-48cc-9232-9701066ff5e7'
const submissionId = '6b34092b-74a2-4d52-a339-672964a86da4'

function store(role: 'administrator' | 'teacher' = 'administrator') {
  const database = {
    schoolMembership: { findUnique: vi.fn().mockResolvedValue({ role }) },
    bureauAccess: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ role: 'reportManager', revokedAt: null }),
    },
    reportingSubmission: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        id: submissionId,
        currentVersion: 2,
        reportingPeriod: { organizationId },
      }),
    },
    reportingReviewNote: {
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve(data)),
      findMany: vi.fn().mockResolvedValue([]),
    },
  }
  return database
}

describe('reporting review notes', () => {
  it('appends school notes to the submitted version and excludes bureau-internal notes from school reads', async () => {
    const database = store()
    const client = database as unknown as PrismaClient
    await addSchoolReportingNote(
      client,
      actor,
      periodId,
      schoolId,
      'Please review the revised total.',
    )
    expect(database.reportingReviewNote.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        submissionId,
        version: 2,
        visibility: 'schoolAndBureau',
      }),
    })
    await listSchoolReportingNotes(client, actor, periodId, schoolId)
    expect(database.reportingReviewNote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { submissionId, visibility: 'schoolAndBureau' },
      }),
    )
    await expect(
      addSchoolReportingNote(
        client,
        actor,
        periodId,
        schoolId,
        '<script>bad</script>',
      ),
    ).rejects.toThrow()
  })

  it('allows scoped bureau notes and denies ordinary teachers', async () => {
    const database = store()
    const client = database as unknown as PrismaClient
    await addBureauReportingNote(
      client,
      actor,
      organizationId,
      submissionId,
      'bureauInternal',
      'Check source totals.',
    )
    await listBureauReportingNotes(client, actor, organizationId, submissionId)
    expect(database.reportingReviewNote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { submissionId } }),
    )
    await expect(
      addBureauReportingNote(
        client,
        actor,
        schoolId,
        submissionId,
        'bureauInternal',
        'Wrong scope',
      ),
    ).rejects.toThrow('Reporting scope mismatch')
    const teacher = store('teacher') as unknown as PrismaClient
    await expect(
      addSchoolReportingNote(teacher, actor, periodId, schoolId, 'Cannot post'),
    ).rejects.toThrow('School reporting permission denied')
  })
})
