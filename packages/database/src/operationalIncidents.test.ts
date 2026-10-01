import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import {
  changeOperationalIncidentStatus,
  createOperationalIncident,
  postOperationalIncidentUpdate,
} from './operationalIncidents.js'

function fixture(status: 'open' | 'monitoring' | 'resolved' = 'open') {
  const tx = {
    operationalIncident: {
      create: vi.fn().mockResolvedValue({ id: 'incident' }),
      findUnique: vi.fn().mockResolvedValue({ id: 'incident', status }),
      update: vi.fn().mockResolvedValue({ id: 'incident', status: 'resolved' }),
    },
    operationalIncidentUpdate: {
      create: vi.fn().mockResolvedValue({ id: 'update' }),
    },
    auditEvent: { create: vi.fn() },
  }
  const database = {
    $transaction: async (work: (value: typeof tx) => Promise<unknown>) =>
      work(tx),
  } as unknown as PrismaClient
  return { database, tx }
}

describe('operational incident timeline', () => {
  it('creates an incident with its first append-only update and audit', async () => {
    const { database, tx } = fixture()
    await createOperationalIncident(
      database,
      '3e480e62-47d7-4525-9d88-b8891e56fac0',
      {
        severity: 'critical',
        title: 'Database unavailable',
        summary: 'Connections are failing',
      },
    )
    expect(tx.operationalIncidentUpdate.create).toHaveBeenCalledWith({
      data: {
        incidentId: 'incident',
        status: 'open',
        eventType: 'declared',
        message: 'Connections are failing',
        createdById: '3e480e62-47d7-4525-9d88-b8891e56fac0',
      },
    })
    expect(tx.auditEvent.create).toHaveBeenCalled()
  })

  it('records a status transition without rewriting history', async () => {
    const { database, tx } = fixture('monitoring')
    await changeOperationalIncidentStatus(
      database,
      'incident',
      '3e480e62-47d7-4525-9d88-b8891e56fac0',
      'resolved',
      'Service recovered',
    )
    expect(tx.operationalIncident.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'resolved',
          resolvedById: '3e480e62-47d7-4525-9d88-b8891e56fac0',
        }),
      }),
    )
    expect(tx.operationalIncidentUpdate.create).toHaveBeenCalledWith({
      data: {
        incidentId: 'incident',
        status: 'resolved',
        message: 'Service recovered',
        createdById: '3e480e62-47d7-4525-9d88-b8891e56fac0',
      },
    })
    await expect(
      changeOperationalIncidentStatus(
        database,
        'incident',
        '3e480e62-47d7-4525-9d88-b8891e56fac0',
        'open',
        'Reopen',
      ),
    ).rejects.toThrow('Invalid incident status transition')
  })

  it('rejects updates after resolution and personal identifiers', async () => {
    const { database, tx } = fixture('resolved')
    await expect(
      postOperationalIncidentUpdate(
        database,
        'incident',
        '3e480e62-47d7-4525-9d88-b8891e56fac0',
        'Still down',
      ),
    ).rejects.toThrow('not open')
    await expect(
      postOperationalIncidentUpdate(
        database,
        'incident',
        '3e480e62-47d7-4525-9d88-b8891e56fac0',
        'student@example.test',
      ),
    ).rejects.toThrow()
    expect(tx.operationalIncidentUpdate.create).not.toHaveBeenCalled()
  })
})
