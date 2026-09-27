import { afterEach, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { OperationsWorkspace } from './OperationsWorkspace'
import {
  getOperationsStatus,
  getStorageSummary,
  listBackups,
  listIncidents,
  listMaintenance,
  requestBackup,
  verifyBackup,
  rehearseBackup,
  getSchedulerState,
  listScheduledExecutions,
  listDueBackupPolicies,
  retryScheduledExecution,
  listFileSecurityScans,
} from './operationsApi'

vi.mock('./operationsApi', () => ({
  getOperationsStatus: vi.fn(),
  getStorageSummary: vi.fn(),
  listBackups: vi.fn(),
  listIncidents: vi.fn(),
  listMaintenance: vi.fn(),
  requestBackup: vi.fn(),
  verifyBackup: vi.fn(),
  rehearseBackup: vi.fn(),
  createIncident: vi.fn(),
  addIncidentUpdate: vi.fn(),
  changeIncidentStatus: vi.fn(),
  getIncident: vi.fn(),
  createMaintenance: vi.fn(),
  changeMaintenanceStatus: vi.fn(),
  getSchedulerState: vi.fn(),
  listScheduledExecutions: vi.fn(),
  listDueBackupPolicies: vi.fn(),
  retryScheduledExecution: vi.fn(),
  listFileSecurityScans: vi.fn(),
  rescanFileAsset: vi.fn(),
  removeQuarantinedAsset: vi.fn(),
}))

const id = '123e4567-e89b-42d3-a456-426614174001'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

it('shows safe operational sections and runs backup, verification, and rehearsal actions', async () => {
  vi.mocked(getOperationsStatus).mockResolvedValue({
    readiness: { status: 'ready', dependencies: { database: 'ready' } },
    recentBackup: null,
    latestRehearsal: { id, status: 'succeeded' },
    openIncidents: [],
    plannedMaintenance: [],
    metrics: [{ route: 'GET /health', requests: 2, errors: 0, durationMs: 12 }],
  })
  vi.mocked(getStorageSummary).mockResolvedValue({
    availableAssetCount: 2,
    storedBytes: '1024',
    quarantinedAssetCount: 0,
    byPurpose: [{ purpose: 'learningMaterial', count: 2 }],
  })
  vi.mocked(listFileSecurityScans).mockResolvedValue([])
  vi.mocked(listBackups).mockResolvedValue([
    {
      id,
      scope: 'database',
      status: 'completed',
      createdAt: '2026-01-01T00:00:00.000Z',
      startedAt: '2026-01-01T00:00:00.000Z',
      completedAt: '2026-01-01T00:00:01.000Z',
      sizeBytes: '12',
      verifiedAt: null,
      verificationResult: null,
    },
  ])
  vi.mocked(listIncidents).mockResolvedValue([])
  vi.mocked(listMaintenance).mockResolvedValue([])
  vi.mocked(getSchedulerState).mockResolvedValue({
    status: 'healthy',
    enabled: true,
    lastPollAt: '2026-01-01T00:00:00.000Z',
    lastSuccessfulTaskAt: '2026-01-01T00:00:00.000Z',
    runningTaskCount: 0,
    recentFailedTaskCount: 0,
  })
  vi.mocked(listScheduledExecutions).mockResolvedValue([
    {
      id,
      taskType: 'backup',
      scope: 'database',
      status: 'failed',
      attempt: 1,
      scheduledFor: '2026-01-01T00:00:00.000Z',
      startedAt: '2026-01-01T00:00:00.000Z',
      completedAt: '2026-01-01T00:00:01.000Z',
      failureCode: 'BACKUP_FAILED',
      eligibleCount: null,
      oldestEligibleAt: null,
      retryEligible: true,
    },
  ])
  vi.mocked(listDueBackupPolicies).mockResolvedValue([
    {
      scope: 'database',
      enabled: true,
      frequency: 'daily',
      verificationRequired: true,
      retentionCount: 7,
      due: true,
    },
  ])
  vi.mocked(retryScheduledExecution).mockResolvedValue({})
  vi.mocked(requestBackup).mockResolvedValue({})
  vi.mocked(verifyBackup).mockResolvedValue({})
  vi.mocked(rehearseBackup).mockResolvedValue({})
  render(<OperationsWorkspace baseUrl="http://localhost:3000/api" />)
  await screen.findByRole('heading', { name: 'Operations' })
  expect(screen.getByText('Available assets: 2')).toBeTruthy()
  expect(screen.getByText('Latest: succeeded')).toBeTruthy()
  expect(
    screen.getByText('Automatic scheduled execution: healthy'),
  ).toBeTruthy()
  expect(screen.getByText(/BACKUP_FAILED/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Retry scheduled task' }))
  await waitFor(() =>
    expect(retryScheduledExecution).toHaveBeenCalledWith(
      'http://localhost:3000/api',
      id,
    ),
  )
  expect(screen.getByText(/GET \/health: 2 requests/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Run backup' }))
  await waitFor(() => expect(requestBackup).toHaveBeenCalled())
  fireEvent.click(screen.getByRole('button', { name: 'Verify backup' }))
  await waitFor(() =>
    expect(verifyBackup).toHaveBeenCalledWith('http://localhost:3000/api', id),
  )
  expect(screen.queryByText(/storageReference|DATABASE_URL/)).toBeNull()
})
