import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import {
  MaintenanceWindowInputSchema,
  changeMaintenanceWindowStatus,
  createMaintenanceWindow,
} from './maintenanceWindows.js'

const actorId = '3e480e62-47d7-4525-9d88-b8891e56fac0'

describe('maintenance windows', () => {
  it('requires start before end and operational plain text', () => {
    expect(() =>
      MaintenanceWindowInputSchema.parse({
        title: 'Upgrade',
        reason: 'Routine update',
        startsAt: '2026-01-02',
        endsAt: '2026-01-01',
      }),
    ).toThrow()
    expect(() =>
      MaintenanceWindowInputSchema.parse({
        title: '<b>Upgrade</b>',
        reason: 'Routine update',
        startsAt: '2026-01-01',
        endsAt: '2026-01-02',
      }),
    ).toThrow()
  })

  it('creates and audits a window without changing service availability', async () => {
    const tx = {
      maintenanceWindow: {
        create: vi.fn().mockResolvedValue({ id: 'window' }),
      },
      auditEvent: { create: vi.fn() },
    }
    const database = {
      $transaction: async (work: (value: typeof tx) => Promise<unknown>) =>
        work(tx),
    } as unknown as PrismaClient
    await createMaintenanceWindow(database, actorId, {
      title: 'Upgrade',
      reason: 'Routine update',
      startsAt: '2026-01-01',
      endsAt: '2026-01-02',
    })
    expect(tx.maintenanceWindow.create).toHaveBeenCalled()
    expect(tx.auditEvent.create).toHaveBeenCalled()
  })

  it('rejects transitions after completion', async () => {
    const tx = {
      maintenanceWindow: {
        findUnique: vi.fn().mockResolvedValue({ status: 'completed' }),
        update: vi.fn(),
      },
      auditEvent: { create: vi.fn() },
    }
    const database = {
      $transaction: async (work: (value: typeof tx) => Promise<unknown>) =>
        work(tx),
    } as unknown as PrismaClient
    await expect(
      changeMaintenanceWindowStatus(database, 'window', actorId, 'scheduled'),
    ).rejects.toThrow('Invalid maintenance')
    expect(tx.maintenanceWindow.update).not.toHaveBeenCalled()
  })
})
