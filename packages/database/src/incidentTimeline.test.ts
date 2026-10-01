import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { appendIncidentTimelineEvent } from './operationalIncidents.js'

describe('incident timeline', () => {
  it('appends correction evidence and audits the privileged action', async () => {
    const tx = {
      operationalIncident: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ id: 'incident', status: 'investigating' }),
      },
      operationalIncidentUpdate: {
        create: vi.fn().mockResolvedValue({ id: 'event' }),
      },
      auditEvent: { create: vi.fn() },
    }
    const database = {
      $transaction: (work: (value: typeof tx) => unknown) => work(tx),
    } as unknown as PrismaClient
    await appendIncidentTimelineEvent(
      database,
      'incident',
      '3e480e62-47d7-4525-9d88-b8891e56fac0',
      'correction',
      'Corrected the prior operational timestamp',
    )
    expect(tx.operationalIncidentUpdate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: 'correction' }),
      }),
    )
    expect(tx.auditEvent.create).toHaveBeenCalled()
  })

  it('rejects unbounded timeline event types and private identifiers', async () => {
    await expect(
      appendIncidentTimelineEvent(
        {} as PrismaClient,
        'incident',
        'actor',
        'password',
        'user@example.test',
      ),
    ).rejects.toThrow()
  })
})
