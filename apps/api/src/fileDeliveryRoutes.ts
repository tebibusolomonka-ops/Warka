import type {
  FastifyInstance,
  FastifyReply,
  preHandlerHookHandler,
} from 'fastify'
import type { PrismaClient } from '@warka/database'
import { z } from 'zod'
import { authenticatedUser } from './authenticateRequest.js'
import {
  FileAssetAccessError,
  requireFileAssetAccess,
} from './fileAssetAccess.js'
import { configuredFileStorage } from './objectFileStorage.js'
import type { FileStorage } from './fileStorage.js'

const materialParams = z.strictObject({
  schoolId: z.uuid(),
  materialId: z.uuid(),
})
const schoolParams = z.strictObject({ schoolId: z.uuid() })
const courseworkParams = schoolParams.extend({
  assignmentId: z.uuid(),
  attachmentId: z.uuid(),
})

function disposition(name: string) {
  const safe = [...name]
    .map((character) => {
      const code = character.codePointAt(0) ?? 0
      return code < 32 || code === 127 || '"\\/'.includes(character)
        ? '_'
        : character
    })
    .join('')
    .slice(0, 120)
  return `attachment; filename="${safe || 'download'}"`
}

export function registerFileDeliveryRoutes(
  app: FastifyInstance,
  getDatabase: () => PrismaClient,
  authenticate: preHandlerHookHandler,
  storage?: FileStorage,
) {
  async function deliver(
    assetId: string,
    actorId: string,
    schoolId: string,
    reply: FastifyReply,
  ) {
    const asset = await requireFileAssetAccess(
      getDatabase(),
      actorId,
      assetId,
      'read',
    )
    if (asset.schoolId !== schoolId) throw new FileAssetAccessError()
    let file
    try {
      file = await (storage ?? configuredFileStorage()).get(asset.storageKey)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT')
        throw new FileAssetAccessError()
      throw error
    }
    reply.header('Content-Type', asset.contentType)
    reply.header('Content-Length', String(file.sizeBytes))
    reply.header('Content-Disposition', disposition(asset.originalFileName))
    reply.header('Cache-Control', 'private, no-store')
    reply.header('X-Content-Type-Options', 'nosniff')
    return reply.send(file.stream)
  }

  app.get(
    '/schools/:schoolId/materials/:materialId/download',
    { preHandler: authenticate, compress: false },
    async (request, reply) => {
      const { schoolId, materialId } = materialParams.parse(request.params)
      const material = await getDatabase().learningMaterial.findFirst({
        where: { id: materialId, schoolId, resourceType: 'file' },
        select: { fileAsset: { select: { id: true } } },
      })
      if (!material?.fileAsset) throw new FileAssetAccessError()
      return deliver(
        material.fileAsset.id,
        authenticatedUser(request).id,
        schoolId,
        reply,
      )
    },
  )

  app.get(
    '/schools/:schoolId/coursework/:assignmentId/attachments/:attachmentId/download',
    { preHandler: authenticate, compress: false },
    async (request, reply) => {
      const { schoolId, assignmentId, attachmentId } = courseworkParams.parse(
        request.params,
      )
      const attachment = await getDatabase().courseworkAttachment.findFirst({
        where: { id: attachmentId, schoolId, assignmentId, removedAt: null },
        select: { fileAssetId: true },
      })
      if (!attachment) throw new FileAssetAccessError()
      return deliver(
        attachment.fileAssetId,
        authenticatedUser(request).id,
        schoolId,
        reply,
      )
    },
  )

  app.get(
    '/schools/:schoolId/document-profile/logo',
    { preHandler: authenticate, compress: false },
    async (request, reply) => {
      const { schoolId } = schoolParams.parse(request.params)
      const profile = await getDatabase().schoolDocumentProfile.findUnique({
        where: { schoolId },
        select: { logoAssetId: true },
      })
      if (!profile?.logoAssetId) throw new FileAssetAccessError()
      return deliver(
        profile.logoAssetId,
        authenticatedUser(request).id,
        schoolId,
        reply,
      )
    },
  )
}
