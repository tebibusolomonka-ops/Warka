import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import { z } from 'zod'
import { authenticatedUser } from './authenticateRequest.js'
import {
  LearningMaterialInputSchema,
  type LearningMaterialService,
} from './learningMaterialService.js'

const schoolParams = z.object({ schoolId: z.uuid() })
const materialParams = schoolParams.extend({ materialId: z.uuid() })

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
  app.get('/student/materials', { preHandler: authenticate }, async (request) =>
    getMaterials().studentList(authenticatedUser(request).id),
  )
}
