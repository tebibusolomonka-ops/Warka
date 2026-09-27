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
})
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

export type Backup = z.infer<typeof backup>
export type Incident = z.infer<typeof incident>
export type Maintenance = z.infer<typeof maintenance>
export type OperationsStatus = z.infer<typeof status>
export type IncidentTimeline = z.infer<typeof timeline>

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

async function post(baseUrl: string, path: string, body: unknown = {}) {
  return requestJson(baseUrl, path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

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
