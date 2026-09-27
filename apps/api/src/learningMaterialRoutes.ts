import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import { z } from 'zod'
import { authenticatedUser } from './authenticateRequest.js'
import {
  LearningMaterialInputSchema,
  type LearningMaterialService,
} from './learningMaterialService.js'

const schoolParams = z.object({ schoolId: z.uuid() })
const materialParams = schoolParams.extend({ materialId: z.uuid() })
const uploadBody = z.strictObject({
  originalFileName: z.string().min(1).max(120),
  contentType: z.string().min(1).max(100),
  base64: z
    .string()
    .min(4)
    .max(28_000_000)
    .regex(/^[A-Za-z0-9+/]+={0,2}$/),
})

export function registerLearningMaterialRoutes(
  app: FastifyInstance,
  getMaterials: () => LearningMaterialService,
  authenticate: preHandlerHookHandler,
) {
  app.post(
    '/schools/:schoolId/materials',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId } = schoolParams.parse(request.params)
      const input = LearningMaterialInputSchema.parse(request.body)
      return reply
        .code(201)
        .send(
          await getMaterials().create(
            authenticatedUser(request).id,
            schoolId,
            input,
          ),
        )
    },
  )
  app.get(
    '/schools/:schoolId/materials',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId } = schoolParams.parse(request.params)
      return getMaterials().staffList(authenticatedUser(request).id, schoolId)
    },
  )
  app.post(
    '/schools/:schoolId/materials/:materialId/publish',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId, materialId } = materialParams.parse(request.params)
      return getMaterials().publish(
        authenticatedUser(request).id,
        schoolId,
        materialId,
      )
    },
  )
  app.post(
    '/schools/:schoolId/materials/:materialId/upload',
    { preHandler: authenticate, bodyLimit: 28 * 1024 * 1024 },
    async (request, reply) => {
      const { schoolId, materialId } = materialParams.parse(request.params)
      const body = uploadBody.parse(request.body)
      const result = await getMaterials().upload(
        authenticatedUser(request).id,
        schoolId,
        materialId,
        {
          bytes: Buffer.from(body.base64, 'base64'),
          originalFileName: body.originalFileName,
          claimedContentType: body.contentType,
        },
      )
      return reply.code(201).send(result)
    },
  )
  app.get('/student/materials', { preHandler: authenticate }, async (request) =>
    getMaterials().studentList(authenticatedUser(request).id),
  )
}
