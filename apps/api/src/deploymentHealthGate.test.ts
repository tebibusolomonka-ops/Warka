import { describe, expect, it } from 'vitest'
import { evaluateDeploymentHealthGate } from './deploymentHealthGate.js'

const readiness = {
  status: 'ready',
  reasons: [],
  dependencies: {
    database: 'ready',
    documentRenderer: 'ready',
    backupStorage: 'ready',
    scanner: 'available',
    email: 'available',
    communicationScheduler: 'ready',
  },
  migration: 'ready',
} as const

describe('deployment health gate', () => {
  it('requires all release gates rather than liveness alone', () => {
    expect(
      evaluateDeploymentHealthGate({
        readiness,
        apiVersion: '1.0.0',
        webVersion: '1.0.0',
        scheduler: 'healthy',
        workersRecovered: true,
      }),
    ).toEqual({ status: 'healthy', reasons: [] })
    expect(
      evaluateDeploymentHealthGate({
        readiness,
        apiVersion: '1.0.0',
        webVersion: '2.0.0',
        scheduler: 'healthy',
        workersRecovered: true,
      }),
    ).toMatchObject({ status: 'blocked', reasons: ['releaseVersionMismatch'] })
  })

  it('reports optional scheduler degradation factually', () => {
    expect(
      evaluateDeploymentHealthGate({
        readiness,
        apiVersion: '1',
        webVersion: '1',
        scheduler: 'degraded',
        workersRecovered: true,
      }).status,
    ).toBe('degraded')
  })
})
