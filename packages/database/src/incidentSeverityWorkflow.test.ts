import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import {
  changeOperationalIncidentSeverity,
  incidentSeverityMeaning,
} from './operationalIncidents.js'

describe('incident severity workflow', () => {
  it('uses factual operational meanings', () => {
    expect(Object.keys(incidentSeverityMeaning)).toEqual(
      expect.arrayContaining(['critical', 'high', 'medium', 'low']),
    )
    expect(Object.values(incidentSeverityMeaning).join(' ')).not.toMatch(
      /student|school rank/i,
    )
  })

  it('changes severity with timeline and audit evidence', async () => {
    const tx = {
      operationalIncident: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ id: 'incident', status: 'investigating' }),
        update: vi
          .fn()
          .mockResolvedValue({ id: 'incident', severity: 'critical' }),
      },
      operationalIncidentUpdate: { create: vi.fn() },
      auditEvent: { create: vi.fn() },
    }
    const database = {
      $transaction: (work: (value: typeof tx) => unknown) => work(tx),
    } as unknown as PrismaClient
    await changeOperationalIncidentSeverity(
      database,
      'incident',
      '3e480e62-47d7-4525-9d88-b8891e56fac0',
      'critical',
      'Database service unavailable',
    )
    expect(tx.operationalIncidentUpdate.create).toHaveBeenCalled()
    expect(tx.auditEvent.create).toHaveBeenCalled()
  })
})
