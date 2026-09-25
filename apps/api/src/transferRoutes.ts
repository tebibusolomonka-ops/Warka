import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import { TransferOptionsSchema, TransferViewSchema } from '@warka/shared'
import { z } from 'zod'
import { authenticatedUser } from './authenticateRequest.js'
import type { TransferManagementService } from './transferManagementService.js'

const schoolParams = z.strictObject({ schoolId: z.uuid() })
const transferParams = z.strictObject({
  schoolId: z.uuid(),
  transferId: z.uuid(),
})
const requestBody = z.strictObject({
  studentId: z.uuid(),
  sourceEnrollmentId: z.uuid(),
  receivingSchoolId: z.uuid(),
})
const acceptBody = z.strictObject({
  academicYearId: z.uuid(),
  gradeLevelId: z.uuid(),
  schoolClassId: z.uuid().nullable().optional(),
})
const reasonBody = z.strictObject({
  reason: z.string().trim().min(3).max(1000),
})

export function registerTransferRoutes(
  app: FastifyInstance,
  getTransfers: () => TransferManagementService,
  authenticate: preHandlerHookHandler,
) {
  app.get(
    '/schools/:schoolId/transfers/options',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId } = schoolParams.parse(request.params)
      return TransferOptionsSchema.parse(
        await getTransfers().options(authenticatedUser(request).id, schoolId),
      )
    },
  )
  for (const direction of ['outgoing', 'incoming'] as const) {
    app.get(
      '/schools/:schoolId/transfers/' + direction,
      { preHandler: authenticate },
      async (request) => {
        const { schoolId } = schoolParams.parse(request.params)
        return z
          .array(TransferViewSchema)
          .parse(
            await getTransfers().list(
              authenticatedUser(request).id,
              schoolId,
              direction,
            ),
          )
      },
    )
  }
  app.get(
    '/schools/:schoolId/transfers/:transferId',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId, transferId } = transferParams.parse(request.params)
      return TransferViewSchema.parse(
        await getTransfers().detail(
          authenticatedUser(request).id,
          schoolId,
          transferId,
        ),
      )
    },
  )
  app.post(
    '/schools/:schoolId/transfers',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId } = schoolParams.parse(request.params)
      const body = requestBody.parse(request.body)
      return reply
        .code(201)
        .send(
          TransferViewSchema.parse(
            await getTransfers().request(
              authenticatedUser(request).id,
              schoolId,
              body.studentId,
              body.sourceEnrollmentId,
              body.receivingSchoolId,
            ),
          ),
        )
    },
  )
  app.post(
    '/schools/:schoolId/transfers/:transferId/approve',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId, transferId } = transferParams.parse(request.params)
      return TransferViewSchema.parse(
        await getTransfers().approve(
          authenticatedUser(request).id,
          schoolId,
          transferId,
        ),
      )
    },
  )
  app.post(
    '/schools/:schoolId/transfers/:transferId/accept',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId, transferId } = transferParams.parse(request.params)
      return TransferViewSchema.parse(
        await getTransfers().accept(
          authenticatedUser(request).id,
          schoolId,
          transferId,
          acceptBody.parse(request.body),
        ),
      )
    },
  )
  app.post(
    '/schools/:schoolId/transfers/:transferId/reject',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId, transferId } = transferParams.parse(request.params)
      return TransferViewSchema.parse(
        await getTransfers().reject(
          authenticatedUser(request).id,
          schoolId,
          transferId,
          reasonBody.parse(request.body).reason,
        ),
      )
    },
  )
  app.post(
    '/schools/:schoolId/transfers/:transferId/cancel',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId, transferId } = transferParams.parse(request.params)
      return TransferViewSchema.parse(
        await getTransfers().cancel(
          authenticatedUser(request).id,
          schoolId,
          transferId,
          reasonBody.parse(request.body).reason,
        ),
      )
    },
  )
}
