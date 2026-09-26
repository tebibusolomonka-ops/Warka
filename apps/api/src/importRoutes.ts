import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import {
  applyStudentImport,
  cancelImportJob,
  createImportJob,
  getImportJob,
  listSchoolImportJobs,
  validateStudentImport,
  type PrismaClient,
} from '@warka/database'
import { z } from 'zod'
import { authenticatedUser } from './authenticateRequest.js'

export class ImportPayloadError extends Error {
  constructor(message: string) {
    super(message)
  }
}

const SchoolParams = z.strictObject({ schoolId: z.uuid() })
const JobParams = z.strictObject({ schoolId: z.uuid(), jobId: z.uuid() })
const CsvBody = z.strictObject({
  csv: z.string(),
  originalFileName: z.string().trim().min(1).max(255).optional(),
})

function checkedCsv(body: unknown) {
  const data = CsvBody.parse(body)
  if (
    data.originalFileName &&
    !data.originalFileName.toLowerCase().endsWith('.csv')
  )
    throw new ImportPayloadError('Only CSV files are supported')
  if (Buffer.byteLength(data.csv, 'utf8') > 1_000_000)
    throw new ImportPayloadError('CSV exceeds the size limit')
  return data
}

function publicJob<T extends { normalizedRows: unknown }>(job: T) {
  const { normalizedRows, ...response } = job
  void normalizedRows
  return response
}

export function registerImportRoutes(
  app: FastifyInstance,
  getDatabase: () => PrismaClient,
  authenticate: preHandlerHookHandler,
) {
  app.get(
    '/schools/:schoolId/imports',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId } = SchoolParams.parse(request.params)
      const jobs = await listSchoolImportJobs(
        getDatabase(),
        authenticatedUser(request).id,
        schoolId,
      )
      return jobs.map(publicJob)
    },
  )
  app.post(
    '/schools/:schoolId/imports',
    { preHandler: authenticate, bodyLimit: 1_100_000 },
    async (request) => {
      const { schoolId } = SchoolParams.parse(request.params)
      const data = checkedCsv(request.body)
      const actorUserId = authenticatedUser(request).id
      const job = await createImportJob(getDatabase(), actorUserId, {
        schoolId,
        ...(data.originalFileName
          ? { originalFileName: data.originalFileName }
          : {}),
      })
      return publicJob(
        await validateStudentImport(
          getDatabase(),
          actorUserId,
          schoolId,
          job.id,
          data.csv,
        ),
      )
    },
  )
  app.get(
    '/schools/:schoolId/imports/:jobId',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId, jobId } = JobParams.parse(request.params)
      return publicJob(
        await getImportJob(
          getDatabase(),
          authenticatedUser(request).id,
          schoolId,
          jobId,
        ),
      )
    },
  )
  app.post(
    '/schools/:schoolId/imports/:jobId/validate',
    { preHandler: authenticate, bodyLimit: 1_100_000 },
    async (request) => {
      const { schoolId, jobId } = JobParams.parse(request.params)
      const data = checkedCsv(request.body)
      return publicJob(
        await validateStudentImport(
          getDatabase(),
          authenticatedUser(request).id,
          schoolId,
          jobId,
          data.csv,
        ),
      )
    },
  )
  app.post(
    '/schools/:schoolId/imports/:jobId/apply',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId, jobId } = JobParams.parse(request.params)
      const { acknowledgeWarnings } = z
        .strictObject({ acknowledgeWarnings: z.boolean().default(false) })
        .parse(request.body ?? {})
      const result = await applyStudentImport(
        getDatabase(),
        authenticatedUser(request).id,
        schoolId,
        jobId,
        acknowledgeWarnings,
      )
      return { job: publicJob(result.job), created: result.created }
    },
  )
  app.post(
    '/schools/:schoolId/imports/:jobId/cancel',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId, jobId } = JobParams.parse(request.params)
      return publicJob(
        await cancelImportJob(
          getDatabase(),
          authenticatedUser(request).id,
          schoolId,
          jobId,
        ),
      )
    },
  )
}
