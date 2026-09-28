import type { Assessment, PrismaClient } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import {
  assertMarkEntryWindow,
  MarkEntryWindowInputSchema,
  MarkEntryWindowStateError,
} from './markEntryWindows.js'

const id = '6f366e77-a14d-469d-9ea5-737091a426cf'
const now = new Date('2026-10-01T10:00:00.000Z')
const assessment = { id, schoolId: id } as Assessment

function fixture(status: 'open' | 'closed', closesAt: Date, role = 'teacher') {
  return {
    markEntryWindow: {
      findUnique: async () => ({
        status,
        opensAt: new Date('2026-10-01T09:00:00.000Z'),
        closesAt,
      }),
    },
    school: { findUnique: async () => ({ organizationId: id }) },
    organizationMembership: { findUnique: async () => null },
    schoolMembership: {
      findUnique: async () => ({
        role,
        startsAt: new Date('2026-01-01'),
        endsAt: null,
      }),
    },
  } as unknown as PrismaClient
}

describe('mark-entry windows', () => {
  it('rejects invalid time order', () => {
    expect(() =>
      MarkEntryWindowInputSchema.parse({
        schoolId: id,
        assessmentId: id,
        opensAt: '2026-10-01T10:00:00Z',
        closesAt: '2026-10-01T09:00:00Z',
      }),
    ).toThrow()
  })

  it('uses server time and controlled state to allow ordinary entry', async () => {
    expect(
      await assertMarkEntryWindow(
        fixture('open', new Date('2026-10-01T11:00:00Z')),
        id,
        assessment,
        undefined,
        now,
      ),
    ).toBe(false)
    await expect(
      assertMarkEntryWindow(
        fixture('open', now),
        id,
        assessment,
        undefined,
        now,
      ),
    ).rejects.toBeInstanceOf(MarkEntryWindowStateError)
    await expect(
      assertMarkEntryWindow(
        fixture('closed', new Date('2026-10-01T11:00:00Z')),
        id,
        assessment,
        undefined,
        now,
      ),
    ).rejects.toBeInstanceOf(MarkEntryWindowStateError)
  })

  it('requires an administrator or approver and a reason for exceptional override', async () => {
    await expect(
      assertMarkEntryWindow(
        fixture('closed', now),
        id,
        assessment,
        'Needed after review',
        now,
      ),
    ).rejects.toBeInstanceOf(MarkEntryWindowStateError)
    expect(
      await assertMarkEntryWindow(
        fixture('closed', now, 'approver'),
        id,
        assessment,
        'Needed after review',
        now,
      ),
    ).toBe(true)
    await expect(
      assertMarkEntryWindow(
        fixture('closed', now, 'approver'),
        id,
        assessment,
        'bad',
        now,
      ),
    ).rejects.toThrow()
  })
})
