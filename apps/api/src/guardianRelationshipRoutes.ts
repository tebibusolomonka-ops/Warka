import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import {
  hasOrganizationAdminRole,
  revokeGuardianRelationship,
  verifyGuardianRelationship,
  type PrismaClient,
} from '@warka/database'
import { z } from 'zod'
import { authenticatedUser } from './authenticateRequest.js'

const params = z.strictObject({ schoolId: z.uuid(), studentId: z.uuid() })
const guardianParams = z.strictObject({
  schoolId: z.uuid(),
  studentId: z.uuid(),
  guardianId: z.uuid(),
})
const revokeBody = z.strictObject({ reason: z.string().trim().min(1).max(500) })

export function registerGuardianRelationshipRoutes(
  app: FastifyInstance,
  getDatabase: () => PrismaClient,
  authenticate: preHandlerHookHandler,
) {
  app.get(
    '/schools/:schoolId/students/:studentId/guardians',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId, studentId } = params.parse(request.params)
      const actorId = authenticatedUser(request).id
      const database = getDatabase()
      const school = await database.school.findUnique({
        where: { id: schoolId },
      })
      const member = await database.schoolMembership.findUnique({
        where: { userId_schoolId: { userId: actorId, schoolId } },
      })
      const authorized =
        school &&
        ((await hasOrganizationAdminRole(
          database,
          actorId,
          school.organizationId,
        )) ||
          member?.role === 'administrator' ||
          member?.role === 'registrar')
      const enrollment = await database.enrollment.findFirst({
        where: { schoolId, studentId, status: 'approved' },
      })
      if (!authorized || !enrollment)
        return reply.code(404).send({
          error: { code: 'STUDENT_NOT_FOUND', message: 'Student not found' },
        })
      const relationships = await database.studentGuardian.findMany({
        where: { studentId },
        include: {
          guardian: {
            include: {
              access: {
                include: {
                  user: { select: { email: true, displayName: true } },
                },
              },
            },
          },
        },
        orderBy: [{ guardian: { name: 'asc' } }, { guardianId: 'asc' }],
      })
      return relationships.map((item) => ({
        guardianId: item.guardianId,
        name: item.guardian.name,
        relationship: item.relationship,
        verificationStatus:
          item.verificationSchoolId === schoolId
            ? item.verificationStatus
            : 'pending',
        verifiedAt:
          item.verificationSchoolId === schoolId
            ? (item.verifiedAt?.toISOString() ?? null)
            : null,
        revokedAt:
          item.verificationSchoolId === schoolId
            ? (item.revokedAt?.toISOString() ?? null)
            : null,
        account: item.guardian.access
          ? {
              email: item.guardian.access.user.email,
              displayName: item.guardian.access.user.displayName,
            }
          : null,
      }))
    },
  )
  app.post(
    '/schools/:schoolId/students/:studentId/guardians/:guardianId/verify',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId, studentId, guardianId } = guardianParams.parse(
        request.params,
      )
      const item = await verifyGuardianRelationship(
        getDatabase(),
        authenticatedUser(request).id,
        schoolId,
        studentId,
        guardianId,
      )
      return {
        verificationStatus: item.verificationStatus,
        verifiedAt: item.verifiedAt?.toISOString() ?? null,
      }
    },
  )
  app.post(
    '/schools/:schoolId/students/:studentId/guardians/:guardianId/revoke',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId, studentId, guardianId } = guardianParams.parse(
        request.params,
      )
      const { reason } = revokeBody.parse(request.body)
      const item = await revokeGuardianRelationship(
        getDatabase(),
        authenticatedUser(request).id,
        schoolId,
        studentId,
        guardianId,
        reason,
      )
      return {
        verificationStatus: item.verificationStatus,
        revokedAt: item.revokedAt?.toISOString() ?? null,
      }
    },
  )
}
