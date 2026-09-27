import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import { z } from 'zod'
import {
  enqueueFileScanTask,
  recordAuditEvent,
  type PrismaClient,
} from '@warka/database'
import { authenticatedUser } from './authenticateRequest.js'
import { requireOperator } from './operationsAccess.js'
import { configuredFileStorage } from './objectFileStorage.js'
import { configuredScannerName } from './fileScannerConfig.js'
import type { FileStorage } from './fileStorage.js'

const paramsSchema = z.strictObject({ id: z.uuid() })
const querySchema = z.strictObject({
  status: z
    .enum(['pending', 'scanning', 'clean', 'infected', 'failed', 'unavailable'])
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
})

export function registerQuarantineRoutes(
  app: FastifyInstance,
  getDatabase: () => PrismaClient,
  authenticate: preHandlerHookHandler,
  getStorage: () => FileStorage = configuredFileStorage,
) {
  const operator = async (request: Parameters<preHandlerHookHandler>[0]) =>
    requireOperator(getDatabase(), authenticatedUser(request).id)
  app.get(
    '/operations/file-security/scans',
    { preHandler: authenticate },
    async (request) => {
      await operator(request)
      const query = querySchema.parse(request.query)
      const scans = await getDatabase().fileScan.findMany({
      ...(query.status ? { where: { status: query.status } } : {}),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: query.limit,
        select: {
          id: true,
          scanner: true,
          status: true,
          result: true,
          failureCode: true,
          startedAt: true,
          completedAt: true,
          createdAt: true,
          fileAsset: {
            select: {
              id: true,
              schoolId: true,
              purpose: true,
              status: true,
              originalFileName: true,
              createdAt: true,
            },
          },
        },
      })
      return { scans }
    },
  )
  app.post(
    '/operations/file-security/assets/:id/rescan',
    { preHandler: authenticate },
    async (request, reply) => {
      await operator(request)
      const { id } = paramsSchema.parse(request.params)
      const database = getDatabase()
      const asset = await database.fileAsset.findUnique({
        where: { id },
        select: { id: true, schoolId: true, status: true, scanRequired: true },
      })
      if (
        !asset ||
        !asset.scanRequired ||
        !['quarantined', 'pending'].includes(asset.status)
      )
        return reply
          .code(409)
          .send({
            error: {
              code: 'RESCAN_NOT_ALLOWED',
              message: 'Asset is not eligible for rescan',
            },
          })
      const active = await database.fileScan.count({
        where: { fileAssetId: id, status: { in: ['pending', 'scanning'] } },
      })
      if (active)
        return reply
          .code(409)
          .send({
            error: {
              code: 'SCAN_ALREADY_PENDING',
              message: 'Scan already pending',
            },
          })
      const scan = await database.$transaction(async (tx) => {
        const claimed = await tx.fileAsset.updateMany({
          where: { id, status: asset.status },
          data: { status: 'pending' },
        })
        if (claimed.count !== 1) return null
        const created = await tx.fileScan.create({
          data: {
            fileAssetId: id,
            scanner: configuredScannerName(),
            status: 'pending',
          },
        })
        await enqueueFileScanTask(tx as PrismaClient, created.id)
        await recordAuditEvent(tx, {
          schoolId: asset.schoolId ?? undefined,
          actorUserId: authenticatedUser(request).id,
          action: 'fileAsset.rescanRequested',
          resourceType: 'fileAsset',
          resourceId: id,
          metadata: { scanId: created.id },
        })
        return created
      })
      if (!scan)
        return reply
          .code(409)
          .send({
            error: { code: 'RESCAN_CONFLICT', message: 'Asset changed' },
          })
      return reply.code(202).send({ scanId: scan.id, status: 'pending' })
    },
  )
  app.delete(
    '/operations/file-security/assets/:id',
    { preHandler: authenticate },
    async (request, reply) => {
      await operator(request)
      const { id } = paramsSchema.parse(request.params)
      const database = getDatabase()
      const asset = await database.fileAsset.findUnique({
        where: { id },
        select: { id: true, schoolId: true, status: true, storageKey: true },
      })
      if (!asset || asset.status !== 'quarantined')
        return reply
          .code(409)
          .send({
            error: {
              code: 'REMOVAL_NOT_ALLOWED',
              message: 'Asset is not quarantined',
            },
          })
      const claimed = await database.fileAsset.updateMany({
        where: { id, status: 'quarantined' },
        data: { status: 'deleted', deletedAt: new Date() },
      })
      if (claimed.count !== 1)
        return reply
          .code(409)
          .send({
            error: { code: 'REMOVAL_CONFLICT', message: 'Asset changed' },
          })
      await recordAuditEvent(database, {
        schoolId: asset.schoolId ?? undefined,
        actorUserId: authenticatedUser(request).id,
        action: 'fileAsset.quarantineRemoved',
        resourceType: 'fileAsset',
        resourceId: id,
      })
      await getStorage().delete(asset.storageKey)
      return reply.code(204).send()
    },
  )
}
