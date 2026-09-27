import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import { z } from 'zod'
import { authenticatedUser } from './authenticateRequest.js'
import type { DocumentDownloadService } from './documentDownloadService.js'
import { renderReportCard, renderTranscript } from './documentPdf.js'

const paramsSchema = z.strictObject({
  schoolId: z.uuid(),
  documentId: z.uuid(),
})

export function registerDocumentDownloadRoutes(
  app: FastifyInstance,
  getDownloads: () => DocumentDownloadService,
  authenticate: preHandlerHookHandler,
) {
  app.get(
    '/schools/:schoolId/documents/:documentId/download',
    { preHandler: authenticate },
    async (request, reply) => {
      const actor = authenticatedUser(request)
      const { schoolId, documentId } = paramsSchema.parse(request.params)
      const downloads = getDownloads()
      const document = await downloads.find(actor.id, schoolId, documentId)
      const artifact = await downloads.artifact?.(document.id)
      const bytes = artifact
        ? null
        : document.documentType === 'reportCard'
          ? await renderReportCard(document)
          : await renderTranscript(document)
      const filename = `warka-${document.documentType === 'reportCard' ? 'report-card' : 'transcript'}-${document.id}.pdf`
      reply.header('Content-Type', 'application/pdf')
      reply.header('Content-Disposition', `attachment; filename="${filename}"`)
      reply.header('Cache-Control', 'private, no-store')
      if (artifact) {
        reply.header('Content-Length', String(artifact.sizeBytes))
        return reply.send(artifact.stream)
      }
      return reply.send(Buffer.from(bytes!))
    },
  )
}
