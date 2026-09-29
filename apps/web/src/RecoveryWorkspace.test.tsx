import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { RecoveryWorkspace } from './RecoveryWorkspace'
import {
  getRecoverySummary,
  listRecoveryExecutions,
  listRecoveryReviews,
  retryRecoveryExecution,
} from './operationsApi'

vi.mock('./operationsApi', () => ({
  getRecoverySummary: vi.fn(),
  listRecoveryExecutions: vi.fn(),
  listRecoveryReviews: vi.fn(),
  retryRecoveryExecution: vi.fn(),
  resolveRecoveryReview: vi.fn(),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

it('distinguishes retryable, ambiguous, manual, and resolved recovery state', async () => {
  vi.mocked(getRecoverySummary).mockResolvedValue({
    startup: {
      status: 'completed',
      interruptedExecutions: 2,
      staleFileScans: 0,
      ambiguousEmailDeliveries: 1,
      restoreRehearsalsForReview: 1,
    },
    disasterRecovery: {
      status: 'warning',
      lastSuccessfulBackup: '2026-09-30T00:00:00.000Z',
      lastVerification: '2026-09-30T00:10:00.000Z',
      lastRestoreRehearsal: null,
      blockers: [],
      warnings: ['restoreRehearsalMissing'],
    },
  })
  vi.mocked(listRecoveryExecutions).mockResolvedValue([
    {
      id: '123e4567-e89b-42d3-a456-426614174001',
      taskType: 'retentionEvaluation',
      scope: 'organization',
      resourceId: 'policy',
      attempt: 1,
      startedAt: '2026-09-30T00:00:00.000Z',
      interruptedAt: '2026-09-30T00:10:00.000Z',
      claimedAt: '2026-09-30T00:00:00.000Z',
      heartbeatAt: '2026-09-30T00:00:00.000Z',
      leaseExpiresAt: '2026-09-30T00:05:00.000Z',
      recoveryDisposition: 'safeToRetry',
      recoveryReason: 'EXECUTION_OWNERSHIP_LOST',
    },
  ])
  vi.mocked(listRecoveryReviews).mockResolvedValue([
    {
      id: '123e4567-e89b-42d3-a456-426614174002',
      domain: 'emailDelivery',
      resourceType: 'emailDelivery',
      resourceReference: 'delivery',
      reasonCode: 'PROVIDER_OUTCOME_UNKNOWN',
      status: 'open',
      createdAt: '2026-09-30T00:00:00.000Z',
      resolvedAt: null,
      resolution: null,
    },
  ])
  vi.mocked(retryRecoveryExecution).mockResolvedValue({})
  render(<RecoveryWorkspace baseUrl="/api" />)
  expect(
    await screen.findByText(/retentionEvaluation · safeToRetry/),
  ).toBeTruthy()
  expect(
    screen.getByText(/emailDelivery · PROVIDER_OUTCOME_UNKNOWN/),
  ).toBeTruthy()
  expect(screen.getByText('Disaster recovery readiness: warning')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Retry safe task' }))
  await waitFor(() =>
    expect(retryRecoveryExecution).toHaveBeenCalledWith(
      '/api',
      '123e4567-e89b-42d3-a456-426614174001',
    ),
  )
})
