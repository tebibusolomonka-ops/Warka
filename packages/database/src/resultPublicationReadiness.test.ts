import type { PrismaClient } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getResultPublicationReadiness } from './resultPublicationReadiness.js'
import { getGradebookCompleteness } from './gradebookCompleteness.js'
import { previewResults } from './results.js'

vi.mock('./gradebookCompleteness.js', () => ({
  getGradebookCompleteness: vi.fn(),
}))
vi.mock('./results.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./results.js')>()),
  previewResults: vi.fn(),
}))

const id = '6f366e77-a14d-469d-9ea5-737091a426cf'
const context = {
  schoolId: id,
  academicYearId: id,
  gradingPeriodId: id,
  schoolClassId: id,
  subjectId: id,
}

beforeEach(() => {
  vi.mocked(previewResults).mockResolvedValue({
    assessments: [{ id }],
    complete: true,
    gradingSchemeReady: true,
    status: 'pending',
    resultSetId: id,
    rows: [{ calculation: { status: 'ready' } }],
  } as never)
  vi.mocked(getGradebookCompleteness).mockResolvedValue({
    complete: true,
    counts: { pendingMakeUp: 0 },
  } as never)
})

function fixture(locked = true, moderation = false) {
  return {
    markModerationRequest: {
      findFirst: async () => (moderation ? { id } : null),
    },
    gradebookLock: { findUnique: async () => ({ locked }) },
  } as unknown as PrismaClient
}

describe('result publication readiness', () => {
  it('reports ready only for a complete locked submitted result without publishing', async () => {
    const database = fixture()
    const result = await getResultPublicationReadiness(database, id, context)
    expect(result).toMatchObject({
      ready: true,
      blockingIssues: [],
      resultStatus: 'pending',
    })
    expect(previewResults).toHaveBeenCalledWith(database, id, context)
  })

  it('reports unresolved make-up, incomplete marks, moderation, and unlocked gradebook', async () => {
    vi.mocked(getGradebookCompleteness).mockResolvedValue({
      complete: false,
      counts: { pendingMakeUp: 1 },
    } as never)
    const result = await getResultPublicationReadiness(
      fixture(false, true),
      id,
      context,
    )
    expect(result.ready).toBe(false)
    expect(result.blockingIssues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'INCOMPLETE_GRADEBOOK',
        'PENDING_MAKE_UP',
        'PENDING_MODERATION',
        'UNLOCKED_GRADEBOOK',
      ]),
    )
  })

  it('requires existing submission and valid calculation state', async () => {
    vi.mocked(previewResults).mockResolvedValue({
      assessments: [{ id }],
      complete: false,
      gradingSchemeReady: false,
      status: 'draft',
      rows: [],
    } as never)
    const result = await getResultPublicationReadiness(fixture(), id, context)
    expect(result.blockingIssues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['RESULT_CALCULATION', 'RESULT_NOT_SUBMITTED']),
    )
  })
})
