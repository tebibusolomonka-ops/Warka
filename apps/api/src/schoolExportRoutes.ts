import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import {
  createSchoolExport,
  SchoolExportTypeSchema,
  type PrismaClient,
} from '@warka/database'
import { z } from 'zod'
import { authenticatedUser } from './authenticateRequest.js'

const ExportParams = z.strictObject({
  schoolId: z.uuid(),
  type: SchoolExportTypeSchema,
})

export function registerSchoolExportRoutes(
  app: FastifyInstance,
  getDatabase: () => PrismaClient,
  authenticate: preHandlerHookHandler,
) {
  app.get(
    '/schools/:schoolId/exports/:type',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId, type } = ExportParams.parse(request.params)
      const { csv } = await createSchoolExport(
        getDatabase(),
        authenticatedUser(request).id,
        schoolId,
        type,
      )
      return reply
        .header('content-type', 'text/csv; charset=utf-8')
        .header('content-disposition', `attachment; filename="${type}.csv"`)
        .header('cache-control', 'no-store')
        .send(csv)
    },
  )
}
