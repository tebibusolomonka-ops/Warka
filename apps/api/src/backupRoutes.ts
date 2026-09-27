import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import type { PrismaClient } from '@warka/database'
import { recordAuditEvent, updateBackupPolicy } from '@warka/database'
import { z } from 'zod'
import { authenticatedUser } from './authenticateRequest.js'
import {
  executeBackup,
  LocalBackupStorage,
  type BackupStorage,
} from './backupService.js'
import { verifyBackup } from './backupVerification.js'
import { runRestoreRehearsal } from './restoreRehearsal.js'
import { requireOperator } from './operationsAccess.js'

const params = z.strictObject({ id: z.uuid() })
const policyBody = z.strictObject({
  enabled: z.boolean(),
  frequency: z.enum(['daily', 'weekly']),
  retentionCount: z.number().int().min(1).max(365),
  verificationRequired: z.boolean(),
})

export type BackupRouteActions = {
  backup: typeof executeBackup
  verify: typeof verifyBackup
  rehearse: typeof runRestoreRehearsal
  storage: () => BackupStorage
}

function safeBackup(record: {
  id: string
  scope: string
  status: string
  createdAt: Date
  startedAt: Date | null
  completedAt: Date | null
  sizeBytes: bigint | null
  verifiedAt: Date | null
  verificationResult: string | null
}) {
  return {
    id: record.id,
    scope: record.scope,
    status: record.status,
    createdAt: record.createdAt,
    startedAt: record.startedAt,
    completedAt: record.completedAt,
    sizeBytes: record.sizeBytes?.toString() ?? null,
    verifiedAt: record.verifiedAt,
    verificationResult: record.verificationResult,
  }
}

export function registerBackupRoutes(
  app: FastifyInstance,
  getDatabase: () => PrismaClient,
  authenticate: preHandlerHookHandler,
  actions: Partial<BackupRouteActions> = {},
) {
  const storage =
    actions.storage ??
    (() => {
      if (!process.env.BACKUP_STORAGE_DIR)
        throw new Error('Backup storage is not configured')
      return new LocalBackupStorage(process.env.BACKUP_STORAGE_DIR)
    })
  const operator = async (request: Parameters<preHandlerHookHandler>[0]) =>
    requireOperator(getDatabase(), authenticatedUser(request).id)
  app.get(
    '/operations/backups',
    { preHandler: authenticate },
    async (request) => {
      await operator(request)
      const records = await getDatabase().backupRecord.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
      })
      return records.map(safeBackup)
    },
  )
  app.get(
    '/operations/backups/:id',
    { preHandler: authenticate },
    async (request, reply) => {
      await operator(request)
      const { id } = params.parse(request.params)
      const record = await getDatabase().backupRecord.findUnique({
        where: { id },
      })
      return record
        ? safeBackup(record)
        : reply.code(404).send({ error: 'Not found' })
    },
  )
  app.post(
    '/operations/backups',
    { preHandler: authenticate },
    async (request) => {
      await operator(request)
      const actorId = authenticatedUser(request).id
      const id = await (actions.backup ?? executeBackup)({
        database: getDatabase(),
        actorId,
        databaseUrl: process.env.DATABASE_URL ?? '',
        storage: storage(),
      })
      await recordAuditEvent(getDatabase(), {
        actorUserId: actorId,
        action: 'backup.requested',
        resourceType: 'backupRecord',
        resourceId: id,
      })
      return { id }
    },
  )
  app.post(
    '/operations/backups/:id/verify',
    { preHandler: authenticate },
    async (request) => {
      await operator(request)
      const { id } = params.parse(request.params)
      const passed = await (actions.verify ?? verifyBackup)({
        database: getDatabase(),
        id,
        storage: storage(),
      })
      await recordAuditEvent(getDatabase(), {
        actorUserId: authenticatedUser(request).id,
        action: 'backup.verified',
        resourceType: 'backupRecord',
        resourceId: id,
        metadata: { passed },
      })
      return { id, passed }
    },
  )
  app.post(
    '/operations/backups/:id/rehearsals',
    { preHandler: authenticate },
    async (request) => {
      await operator(request)
      const { id } = params.parse(request.params)
      const actorId = authenticatedUser(request).id
      const result = await (actions.rehearse ?? runRestoreRehearsal)({
        database: getDatabase(),
        backupId: id,
        actorId,
        databaseUrl: process.env.DATABASE_URL ?? '',
        storage: storage(),
      })
      await recordAuditEvent(getDatabase(), {
        actorUserId: actorId,
        action: 'backup.rehearsed',
        resourceType: 'restoreRehearsal',
        resourceId: result.id,
        metadata: { passed: result.passed },
      })
      return result
    },
  )
  app.get(
    '/operations/rehearsals/:id',
    { preHandler: authenticate },
    async (request, reply) => {
      await operator(request)
      const { id } = params.parse(request.params)
      const result = await getDatabase().restoreRehearsal.findUnique({
        where: { id },
        select: {
          id: true,
          backupId: true,
          startedAt: true,
          completedAt: true,
          status: true,
        },
      })
      return result ?? reply.code(404).send({ error: 'Not found' })
    },
  )
  app.get(
    '/operations/backup-policy',
    { preHandler: authenticate },
    async (request) => {
      await operator(request)
      return getDatabase().backupPolicy.findUnique({
        where: { id: 'database' },
        select: {
          enabled: true,
          frequency: true,
          retentionCount: true,
          verificationRequired: true,
          updatedAt: true,
        },
      })
    },
  )
  app.put(
    '/operations/backup-policy',
    { preHandler: authenticate },
    async (request) => {
      await operator(request)
      const policy = await updateBackupPolicy(
        getDatabase(),
        authenticatedUser(request).id,
        policyBody.parse(request.body),
      )
      return {
        enabled: policy.enabled,
        frequency: policy.frequency,
        retentionCount: policy.retentionCount,
        verificationRequired: policy.verificationRequired,
        updatedAt: policy.updatedAt,
      }
    },
  )
}
