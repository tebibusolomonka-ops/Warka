import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import { z } from 'zod'
import {
  changeAccountStatus,
  listStaffAccess,
  offboardStaff,
  type PrismaClient,
} from '@warka/database'
import { authenticatedUser } from './authenticateRequest.js'

const schoolParams = z.strictObject({ schoolId: z.uuid() })
const staffParams = z.strictObject({ schoolId: z.uuid(), userId: z.uuid() })
const pagination = z.strictObject({
  take: z.coerce.number().int().min(1).max(50).optional(),
  skip: z.coerce.number().int().min(0).max(100000).optional(),
})
const statusBody = z.strictObject({
  status: z.enum(['active', 'suspended', 'deactivated']),
  reason: z.string().trim().min(3).max(500),
})
const offboardBody = z.strictObject({
  reason: z.string().trim().min(3).max(500),
  endOrganizationMembership: z.boolean().optional(),
})

export function registerStaffAccessRoutes(
  app: FastifyInstance,
  getDatabase: () => PrismaClient,
  authenticate: preHandlerHookHandler,
) {
  app.get(
    '/schools/:schoolId/staff-access',
    { preHandler: authenticate },
    (request) => {
      const { schoolId } = schoolParams.parse(request.params)
      return listStaffAccess(
        getDatabase(),
        authenticatedUser(request).id,
        schoolId,
        pagination.parse(request.query),
      )
    },
  )
  app.post(
    '/schools/:schoolId/staff-access/:userId/status',
    { preHandler: authenticate },
    (request) => {
      const { schoolId, userId } = staffParams.parse(request.params)
      const { status, reason } = statusBody.parse(request.body)
      return changeAccountStatus(getDatabase(), {
        actorUserId: authenticatedUser(request).id,
        targetUserId: userId,
        schoolId,
        status,
        reason,
      }).then((user) => ({ id: user.id, accountStatus: user.accountStatus }))
    },
  )
  app.post(
    '/schools/:schoolId/staff-access/:userId/offboard',
    { preHandler: authenticate },
    (request) => {
      const { schoolId, userId } = staffParams.parse(request.params)
      const body = offboardBody.parse(request.body)
      return offboardStaff(getDatabase(), {
        actorUserId: authenticatedUser(request).id,
        targetUserId: userId,
        schoolId,
        ...body,
      })
    },
  )
}
