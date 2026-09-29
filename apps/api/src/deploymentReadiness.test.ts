import { describe, expect, it } from 'vitest'
import type { PrismaClient } from '@warka/database'
import { evaluateDeploymentReadiness } from './deploymentReadiness.js'
import { classifyMigrationHistory } from './migrationReadiness.js'

const database = {} as PrismaClient
const health = {
  status: 'ready' as const,
  dependencies: {
    database: 'ready' as const,
    documentRenderer: 'ready' as const,
    backupStorage: 'ready' as const,
  },
  email: 'disabled' as const,
}
const communication = {
  status: 'disabled' as const,
  reasons: ['schedulerDisabled' as const],
}

describe('deployment readiness', () => {
  it('distinguishes core blockers from optional degradation', async () => {
    expect(
      (
        await evaluateDeploymentReadiness({
          database,
          env: {},
          readiness: health,
          communication,
          migration: 'ready',
        })
      ).status,
    ).toBe('ready')
    expect(
      (
        await evaluateDeploymentReadiness({
          database,
          env: {},
          readiness: {
            ...health,
            dependencies: { ...health.dependencies, database: 'unavailable' },
          },
          communication,
          migration: 'ready',
        })
      ).status,
    ).toBe('blocked')
    expect(
      (
        await evaluateDeploymentReadiness({
          database,
          env: { WARKA_EMAIL_OUTBOX_ENABLED: 'true' },
          readiness: health,
          communication,
          migration: 'ready',
        })
      ).status,
    ).toBe('degraded')
  })

  it('reports scanner outage and unverified migrations explicitly', async () => {
    const result = await evaluateDeploymentReadiness({
      database,
      env: { WARKA_FILE_SCAN_SCHEDULER_ENABLED: 'true' },
      readiness: { ...health, scanner: 'unavailable' },
      communication,
      migration: 'unavailable',
    })
    expect(result.status).toBe('degraded')
    expect(result.reasons).toEqual(
      expect.arrayContaining(['scannerUnavailable', 'migrationUnverified']),
    )
  })
})

describe('migration history', () => {
  const applied = {
    migration_name: '001',
    finished_at: new Date(),
    rolled_back_at: null,
  }
  it('detects pending, failed, and diverged history without mutation', () => {
    expect(classifyMigrationHistory(['001'], [applied])).toBe('ready')
    expect(classifyMigrationHistory(['001', '002'], [applied])).toBe('pending')
    expect(
      classifyMigrationHistory(['001'], [{ ...applied, finished_at: null }]),
    ).toBe('failed')
    expect(classifyMigrationHistory([], [applied])).toBe('failed')
  })
})
