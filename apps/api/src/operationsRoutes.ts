import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import { z } from 'zod'
import {
  changeMaintenanceWindowStatus,
  changeOperationalIncidentStatus,
  createMaintenanceWindow,
  createOperationalIncident,
  postOperationalIncidentUpdate,
  type PrismaClient,
} from '@warka/database'
import { authenticatedUser } from './authenticateRequest.js'
import { requireOperator } from './operationsAccess.js'
import { sendOperationsAlert } from './operationsAlerts.js'
import { checkReadiness, type Readiness } from './readiness.js'
import type { ServiceMetrics } from './serviceMetrics.js'

const idParams = z.strictObject({ id: z.uuid() })
const updateBody = z.strictObject({
  message: z.string().trim().min(3).max(500),
})
const incidentStatusBody = updateBody.extend({
  status: z.enum(['investigating', 'monitoring', 'resolved']),
})
const maintenanceStatusBody = z.strictObject({
  status: z.enum(['inProgress', 'completed', 'cancelled']),
})

export function registerOperationsRoutes(
  app: FastifyInstance,
  getDatabase: () => PrismaClient,
  authenticate: preHandlerHookHandler,
  metrics: ServiceMetrics,
  readiness: (database: PrismaClient) => Promise<Readiness> = (database) =>
    checkReadiness({ database }),
) {
  const operator = async (request: Parameters<preHandlerHookHandler>[0]) =>
    requireOperator(getDatabase(), authenticatedUser(request).id)
  app.get(
    '/operations/storage',
    { preHandler: authenticate },
    async (request) => {
      await operator(request)
      const database = getDatabase()
      const [summary, byPurpose, quarantined] = await Promise.all([
        database.fileAsset.aggregate({
          where: { status: 'available' },
          _count: { id: true },
          _sum: { sizeBytes: true },
        }),
        database.fileAsset.groupBy({
          by: ['purpose'],
          where: { status: 'available' },
          _count: { id: true },
        }),
        database.fileAsset.count({ where: { status: 'quarantined' } }),
      ])
      return {
        availableAssetCount: summary._count.id,
        storedBytes: (summary._sum.sizeBytes ?? 0n).toString(),
        quarantinedAssetCount: quarantined,
        byPurpose: byPurpose.map((item) => ({
          purpose: item.purpose,
          count: item._count.id,
        })),
      }
    },
  )
  app.get(
    '/operations/status',
    { preHandler: authenticate },
    async (request) => {
      await operator(request)
      const database = getDatabase()
      const [health, backup, rehearsal, incidents, maintenance, scanCounts] =
        await Promise.all([
          readiness(database),
          database.backupRecord.findFirst({
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              status: true,
              createdAt: true,
              verifiedAt: true,
              verificationResult: true,
            },
          }),
          database.restoreRehearsal.findFirst({
            orderBy: { startedAt: 'desc' },
            select: {
              id: true,
              backupId: true,
              status: true,
              startedAt: true,
              completedAt: true,
            },
          }),
          database.operationalIncident.findMany({
            where: { status: { not: 'resolved' } },
            orderBy: { startedAt: 'desc' },
            take: 20,
            select: {
              id: true,
              severity: true,
              title: true,
              status: true,
              startedAt: true,
            },
          }),
          database.maintenanceWindow.findMany({
            where: { status: { in: ['scheduled', 'inProgress'] } },
            orderBy: { startsAt: 'asc' },
            take: 20,
            select: {
              id: true,
              title: true,
              startsAt: true,
              endsAt: true,
              status: true,
            },
          }),
          database.fileScan.groupBy({
            by: ['status'],
            _count: { id: true },
          }),
        ])
      return {
        readiness: health,
        recentBackup: backup,
        latestRehearsal: rehearsal,
        openIncidents: incidents,
        plannedMaintenance: maintenance,
        metrics: metrics.snapshot(),
        fileSecurity: {
          scanner: health.scanner ?? 'unavailable',
          counts: Object.fromEntries(
            scanCounts.map((item) => [item.status, item._count.id]),
          ),
        },
      }
    },
  )
  app.get(
    '/operations/incidents',
    { preHandler: authenticate },
    async (request) => {
      await operator(request)
      return getDatabase().operationalIncident.findMany({
        orderBy: { startedAt: 'desc' },
        take: 50,
        select: {
          id: true,
          severity: true,
          title: true,
          summary: true,
          status: true,
          startedAt: true,
          resolvedAt: true,
        },
      })
    },
  )
  app.post(
    '/operations/incidents',
    { preHandler: authenticate },
    async (request) => {
      await operator(request)
      const incident = await createOperationalIncident(
        getDatabase(),
        authenticatedUser(request).id,
        request.body,
      )
      if (incident.severity === 'critical')
        await sendOperationsAlert(
          getDatabase(),
          'criticalIncident',
          incident.id,
        )
      return incident
    },
  )
  app.get(
    '/operations/incidents/:id',
    { preHandler: authenticate },
    async (request, reply) => {
      await operator(request)
      const { id } = idParams.parse(request.params)
      const incident = await getDatabase().operationalIncident.findUnique({
        where: { id },
        select: {
          id: true,
          severity: true,
          title: true,
          summary: true,
          status: true,
          startedAt: true,
          resolvedAt: true,
          updates: {
            orderBy: { createdAt: 'asc' },
            select: { id: true, status: true, message: true, createdAt: true },
          },
        },
      })
      return incident ?? reply.code(404).send({ error: 'Not found' })
    },
  )
  app.post(
    '/operations/incidents/:id/updates',
    { preHandler: authenticate },
    async (request) => {
      await operator(request)
      return postOperationalIncidentUpdate(
        getDatabase(),
        idParams.parse(request.params).id,
        authenticatedUser(request).id,
        updateBody.parse(request.body).message,
      )
    },
  )
  app.post(
    '/operations/incidents/:id/status',
    { preHandler: authenticate },
    async (request) => {
      await operator(request)
      const { status, message } = incidentStatusBody.parse(request.body)
      const incident = await changeOperationalIncidentStatus(
        getDatabase(),
        idParams.parse(request.params).id,
        authenticatedUser(request).id,
        status,
        message,
      )
      if (status === 'resolved')
        await sendOperationsAlert(
          getDatabase(),
          'incidentResolved',
          incident.id,
        )
      return incident
    },
  )
  app.get(
    '/operations/maintenance',
    { preHandler: authenticate },
    async (request) => {
      await operator(request)
      return getDatabase().maintenanceWindow.findMany({
        orderBy: { startsAt: 'desc' },
        take: 50,
        select: {
          id: true,
          title: true,
          reason: true,
          startsAt: true,
          endsAt: true,
          status: true,
        },
      })
    },
  )
  app.post(
    '/operations/maintenance',
    { preHandler: authenticate },
    async (request) => {
      await operator(request)
      return createMaintenanceWindow(
        getDatabase(),
        authenticatedUser(request).id,
        request.body,
      )
    },
  )
  app.post(
    '/operations/maintenance/:id/status',
    { preHandler: authenticate },
    async (request) => {
      await operator(request)
      return changeMaintenanceWindowStatus(
        getDatabase(),
        idParams.parse(request.params).id,
        authenticatedUser(request).id,
        maintenanceStatusBody.parse(request.body).status,
      )
    },
  )
}
