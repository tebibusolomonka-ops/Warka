import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import {
  applyValidatedImport,
  createImportDryRun,
  createImportSourceProfile,
  generateStudentTransferExchange,
  requireSchoolImportPermission,
  type PrismaClient,
} from '@warka/database'
import { z } from 'zod'
import { authenticatedUser } from './authenticateRequest.js'

const School = z.strictObject({ schoolId: z.uuid() })
const DryRun = z.strictObject({ schoolId: z.uuid(), dryRunId: z.uuid() })
const Transfer = z.strictObject({ schoolId: z.uuid(), transferId: z.uuid() })
export function registerInteroperabilityRoutes(
  app: FastifyInstance,
  getDatabase: () => PrismaClient,
  authenticate: preHandlerHookHandler,
) {
  app.get(
    '/schools/:schoolId/import-source-profiles',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId } = School.parse(request.params)
      const database = getDatabase()
      await requireSchoolImportPermission(
        database,
        authenticatedUser(request).id,
        schoolId,
      )
      return database.importSourceProfile.findMany({
        where: { schoolId },
        orderBy: { name: 'asc' },
      })
    },
  )
  app.post(
    '/schools/:schoolId/import-source-profiles',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId } = School.parse(request.params)
      return createImportSourceProfile(
        getDatabase(),
        authenticatedUser(request).id,
        { ...(request.body as object), schoolId },
      )
    },
  )
  app.post(
    '/schools/:schoolId/import-dry-runs',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId } = School.parse(request.params)
      const database = getDatabase()
      await requireSchoolImportPermission(
        database,
        authenticatedUser(request).id,
        schoolId,
      )
      return createImportDryRun(database, request.body)
    },
  )
  app.post(
    '/schools/:schoolId/import-dry-runs/:dryRunId/apply',
    { preHandler: authenticate },
    async (request) => {
      const { dryRunId } = DryRun.parse(request.params)
      return applyValidatedImport(
        getDatabase(),
        authenticatedUser(request).id,
        { ...(request.body as object), dryRunId },
      )
    },
  )
  app.post(
    '/schools/:schoolId/exchange/student-transfers/:transferId',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId, transferId } = Transfer.parse(request.params)
      return generateStudentTransferExchange(
        getDatabase(),
        authenticatedUser(request).id,
        schoolId,
        transferId,
      )
    },
  )
}
