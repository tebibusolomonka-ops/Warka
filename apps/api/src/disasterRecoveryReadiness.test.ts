import { describe, expect, it, vi } from 'vitest'
import { evaluateDisasterRecoveryReadiness } from './disasterRecoveryReadiness.js'

function databaseFixture(input: {
  backup?: Date
  verification?: Date
  rehearsal?: Date
}) {
  return {
    backupRecord: {
      findFirst: vi
        .fn()
        .mockResolvedValueOnce(
          input.backup ? { completedAt: input.backup } : null,
        )
        .mockResolvedValueOnce(
          input.verification ? { verifiedAt: input.verification } : null,
        ),
    },
    restoreRehearsal: {
      findFirst: vi
        .fn()
        .mockResolvedValue(
          input.rehearsal ? { completedAt: input.rehearsal } : null,
        ),
    },
  }
}

describe('disaster recovery readiness', () => {
  const now = new Date('2026-09-30T10:00:00.000Z')

  it('reports factual recent evidence without a recovery guarantee', async () => {
    const recent = new Date('2026-09-30T09:00:00.000Z')
    const result = await evaluateDisasterRecoveryReadiness({
      database: databaseFixture({
        backup: recent,
        verification: recent,
        rehearsal: recent,
      }) as never,
      now,
      dependencyState: { backupStorage: 'ready', scheduler: 'healthy' },
    })
    expect(result).toEqual({
      status: 'ready',
      lastSuccessfulBackup: recent,
      lastVerification: recent,
      lastRestoreRehearsal: recent,
      blockers: [],
      warnings: [],
    })
    expect(result).not.toHaveProperty('score')
    expect(result).not.toHaveProperty('guaranteed')
  })

  it('reports missing evidence and storage as explicit facts', async () => {
    const result = await evaluateDisasterRecoveryReadiness({
      database: databaseFixture({}) as never,
      now,
      dependencyState: { backupStorage: 'unavailable', scheduler: 'degraded' },
    })
    expect(result.status).toBe('blocked')
    expect(result.blockers).toEqual([
      'backupStorageUnavailable',
      'backupMissing',
    ])
    expect(result.warnings).toEqual([
      'backupSchedulerNotHealthy',
      'verificationMissing',
      'restoreRehearsalMissing',
    ])
  })
})
