import { z } from 'zod'
import { requestJson } from './api'

const date = z.iso.datetime()
const backup = z.object({
  id: z.uuid(),
  scope: z.string(),
  status: z.string(),
  createdAt: date,
  startedAt: date.nullable(),
  completedAt: date.nullable(),
  sizeBytes: z.string().nullable(),
  verifiedAt: date.nullable(),
  verificationResult: z.string().nullable(),
})
const incident = z.object({
  id: z.uuid(),
  severity: z.string(),
  title: z.string(),
  summary: z.string(),
  status: z.string(),
  startedAt: date,
  resolvedAt: date.nullable(),
})
const maintenance = z.object({
  id: z.uuid(),
  title: z.string(),
  reason: z.string(),
  startsAt: date,
  endsAt: date,
  status: z.string(),
})
const metrics = z.array(
  z.object({
    route: z.string(),
    requests: z.number(),
    errors: z.number(),
    durationMs: z.number(),
  }),
)
const status = z.object({
  readiness: z.object({
    status: z.string(),
    dependencies: z.record(z.string(), z.string()),
  }),
  recentBackup: z.object({ id: z.uuid(), status: z.string() }).nullable(),
  latestRehearsal: z.object({ id: z.uuid(), status: z.string() }).nullable(),
  openIncidents: z.array(
    z.object({
      id: z.uuid(),
      severity: z.string(),
      title: z.string(),
      status: z.string(),
    }),
  ),
  plannedMaintenance: z.array(
    z.object({ id: z.uuid(), title: z.string(), status: z.string() }),
  ),
  metrics,
  fileSecurity: z
    .object({
      scanner: z.enum(['available', 'degraded', 'unavailable']),
      counts: z.record(z.string(), z.number()),
    })
    .optional(),
  emailDelivery: z
    .object({
      provider: z.enum(['available', 'unavailable', 'degraded', 'disabled']),
      counts: z.record(z.string(), z.number()),
      retryCount: z.number(),
    })
    .optional(),
})
const deployment = z.object({
  build: z.object({
    version: z.string(),
    commitSha: z.string().nullable(),
    builtAt: z.string().nullable(),
    environment: z.enum(['development', 'test', 'production']),
  }),
  readiness: z.object({
    status: z.enum(['ready', 'degraded', 'blocked']),
    reasons: z.array(z.string()),
    dependencies: z.record(z.string(), z.string()),
    migration: z.enum(['unknown', 'ready', 'pending', 'failed', 'unavailable']),
  }),
  features: z.object({
    backupScheduler: z.boolean(),
    fileScanning: z.boolean(),
    emailOutbox: z.boolean(),
  }),
})
export type DeploymentStatus = z.infer<typeof deployment>
export const getDeploymentStatus = async (baseUrl: string) =>
  deployment.parse(await requestJson(baseUrl, '/operations/deployment'))
const timeline = incident.extend({
  updates: z.array(
    z.object({
      id: z.uuid(),
      status: z.string(),
      message: z.string(),
      createdAt: date,
    }),
  ),
})
const schedulerState = z.object({
  status: z.enum(['healthy', 'degraded', 'disabled']),
  enabled: z.boolean(),
  lastPollAt: date.nullable(),
  lastSuccessfulTaskAt: date.nullable(),
  runningTaskCount: z.number(),
  recentFailedTaskCount: z.number(),
})
const scheduledExecution = z.object({
  id: z.uuid(),
  taskType: z.string(),
  scope: z.string(),
  scheduledFor: date,
  startedAt: date.nullable(),
  completedAt: date.nullable(),
  status: z.string(),
  attempt: z.number(),
  failureCode: z.string().nullable(),
  eligibleCount: z.number().nullable(),
  oldestEligibleAt: date.nullable(),
  retryEligible: z.boolean(),
})
const dueBackupPolicy = z.object({
  scope: z.string(),
  enabled: z.boolean(),
  frequency: z.string(),
  verificationRequired: z.boolean(),
  retentionCount: z.number(),
  due: z.boolean(),
})
const storageSummary = z.object({
  availableAssetCount: z.number(),
  storedBytes: z.string(),
  quarantinedAssetCount: z.number(),
  byPurpose: z.array(z.object({ purpose: z.string(), count: z.number() })),
})

export type Backup = z.infer<typeof backup>
export type Incident = z.infer<typeof incident>
export type Maintenance = z.infer<typeof maintenance>
export type OperationsStatus = z.infer<typeof status>
export type IncidentTimeline = z.infer<typeof timeline>
export type SchedulerState = z.infer<typeof schedulerState>
export type ScheduledExecution = z.infer<typeof scheduledExecution>
export type DueBackupPolicy = z.infer<typeof dueBackupPolicy>
export type StorageSummary = z.infer<typeof storageSummary>
const fileScan = z.object({
  id: z.uuid(),
  scanner: z.string(),
  status: z.string(),
  result: z.string().nullable(),
  failureCode: z.string().nullable(),
  startedAt: date.nullable(),
  completedAt: date.nullable(),
  createdAt: date,
  fileAsset: z.object({
    id: z.uuid(),
    schoolId: z.uuid().nullable(),
    purpose: z.string(),
    status: z.string(),
    originalFileName: z.string(),
    createdAt: date,
  }),
})
export type FileSecurityScan = z.infer<typeof fileScan>
const emailDelivery = z.object({
  id: z.uuid(),
  recipient: z.string(),
  templateKey: z.string(),
  status: z.enum(['queued', 'sending', 'sent', 'failed', 'cancelled']),
  createdAt: date,
  scheduledAt: date,
  attemptCount: z.number(),
  failureCode: z.string().nullable(),
  retryEligible: z.boolean(),
})
export type EmailDeliverySummary = z.infer<typeof emailDelivery>
export const listEmailDeliveries = async (baseUrl: string) =>
  z
    .object({ deliveries: z.array(emailDelivery) })
    .parse(await requestJson(baseUrl, '/operations/email/deliveries'))
    .deliveries
export const retryEmailDelivery = (baseUrl: string, id: string) =>
  requestJson(
    baseUrl,
    `/operations/email/deliveries/${encodeURIComponent(id)}/retry`,
    { method: 'POST' },
  )
export const listFileSecurityScans = async (baseUrl: string) =>
  z
    .object({ scans: z.array(fileScan) })
    .parse(await requestJson(baseUrl, '/operations/file-security/scans')).scans
export const rescanFileAsset = (baseUrl: string, id: string) =>
  requestJson(
    baseUrl,
    `/operations/file-security/assets/${encodeURIComponent(id)}/rescan`,
    { method: 'POST' },
  )
export const removeQuarantinedAsset = (baseUrl: string, id: string) =>
  requestJson(
    baseUrl,
    `/operations/file-security/assets/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  )
export const getStorageSummary = async (baseUrl: string) =>
  storageSummary.parse(await requestJson(baseUrl, '/operations/storage'))

export const getOperationsStatus = async (baseUrl: string) =>
  status.parse(await requestJson(baseUrl, '/operations/status'))
export const listBackups = async (baseUrl: string) =>
  z.array(backup).parse(await requestJson(baseUrl, '/operations/backups'))
export const listIncidents = async (baseUrl: string) =>
  z.array(incident).parse(await requestJson(baseUrl, '/operations/incidents'))
export const getIncident = async (baseUrl: string, id: string) =>
  timeline.parse(
    await requestJson(
      baseUrl,
      `/operations/incidents/${encodeURIComponent(id)}`,
    ),
  )
export const listMaintenance = async (baseUrl: string) =>
  z
    .array(maintenance)
    .parse(await requestJson(baseUrl, '/operations/maintenance'))
export const getSchedulerState = async (baseUrl: string) =>
  schedulerState.parse(await requestJson(baseUrl, '/operations/scheduler'))
export const listScheduledExecutions = async (baseUrl: string) =>
  z
    .array(scheduledExecution)
    .parse(await requestJson(baseUrl, '/operations/scheduler/executions'))
export const listDueBackupPolicies = async (baseUrl: string) =>
  z
    .array(dueBackupPolicy)
    .parse(await requestJson(baseUrl, '/operations/scheduler/due-backups'))

async function post(baseUrl: string, path: string, body: unknown = {}) {
  return requestJson(baseUrl, path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export const retryScheduledExecution = (baseUrl: string, id: string) =>
  post(
    baseUrl,
    `/operations/scheduler/executions/${encodeURIComponent(id)}/retry`,
  )

export const requestBackup = (baseUrl: string) =>
  post(baseUrl, '/operations/backups')
export const verifyBackup = (baseUrl: string, id: string) =>
  post(baseUrl, `/operations/backups/${encodeURIComponent(id)}/verify`)
export const rehearseBackup = (baseUrl: string, id: string) =>
  post(baseUrl, `/operations/backups/${encodeURIComponent(id)}/rehearsals`)
export const createIncident = (
  baseUrl: string,
  input: { severity: string; title: string; summary: string },
) => post(baseUrl, '/operations/incidents', input)
export const addIncidentUpdate = (
  baseUrl: string,
  id: string,
  message: string,
) =>
  post(baseUrl, `/operations/incidents/${encodeURIComponent(id)}/updates`, {
    message,
  })
export const changeIncidentStatus = (
  baseUrl: string,
  id: string,
  status: string,
  message: string,
) =>
  post(baseUrl, `/operations/incidents/${encodeURIComponent(id)}/status`, {
    status,
    message,
  })
export const createMaintenance = (
  baseUrl: string,
  input: { title: string; reason: string; startsAt: string; endsAt: string },
) => post(baseUrl, '/operations/maintenance', input)
export const changeMaintenanceStatus = (
  baseUrl: string,
  id: string,
  status: string,
) =>
  post(baseUrl, `/operations/maintenance/${encodeURIComponent(id)}/status`, {
    status,
  })
