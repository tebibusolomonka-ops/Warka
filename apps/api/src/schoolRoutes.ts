import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import {
  AccessibleSchoolsResponseSchema,
  CreateSchoolSchema,
  OrganizationsResponseSchema,
  SchoolSchema,
  SchoolsResponseSchema,
} from '@warka/shared'
import { z } from 'zod'
import { authenticatedUser } from './authenticateRequest.js'
import type { SchoolAccess } from './schoolAccess.js'
import {
  RecordNotFound,
  schoolService,
  type SchoolStore,
} from './schoolService.js'

const organizationParams = z.object({ organizationId: z.uuid() })
const schoolParams = z.object({ schoolId: z.uuid() })

function serializeDates<T extends { createdAt: Date; updatedAt: Date }>(
  record: T,
) {
  return {
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

export function registerSchoolRoutes(
  app: FastifyInstance,
  getStore: () => SchoolStore,
  getAccess: () => SchoolAccess,
  authenticate: preHandlerHookHandler,
) {
  app.get('/organizations', { preHandler: authenticate }, async (request) => {
    const user = authenticatedUser(request)
    const organizations = await getAccess().organizationsForUser(user.id)
    return OrganizationsResponseSchema.parse(
      organizations.map(({ organization, role }) => ({
        organization: serializeDates(organization),
        role,
      })),
    )
  })

  app.get('/schools', { preHandler: authenticate }, async (request) => {
    const user = authenticatedUser(request)
    const schools = await getAccess().schoolsForUser(user.id)
    return AccessibleSchoolsResponseSchema.parse(
      schools.map(({ school, capabilities }) => ({
        school: serializeDates(school),
        capabilities,
      })),
    )
  })
  app.post(
    '/organizations/:organizationId/schools',
    { preHandler: authenticate },
    async (request, reply) => {
      const user = authenticatedUser(request)
      const { organizationId } = organizationParams.parse(request.params)
      const { name } = CreateSchoolSchema.parse(request.body)
      if (!(await getAccess().canManageOrganization(user.id, organizationId))) {
        throw new RecordNotFound('ORGANIZATION_NOT_FOUND')
      }
      const school = await schoolService(getStore()).createSchool(
        organizationId,
        name,
      )
      return reply.code(201).send(SchoolSchema.parse(serializeDates(school)))
    },
  )

  app.get(
    '/organizations/:organizationId/schools',
    { preHandler: authenticate },
    async (request) => {
      const user = authenticatedUser(request)
      const { organizationId } = organizationParams.parse(request.params)
      if (!(await getAccess().canManageOrganization(user.id, organizationId))) {
        throw new RecordNotFound('ORGANIZATION_NOT_FOUND')
      }
      const schools =
        await schoolService(getStore()).listSchools(organizationId)
      return SchoolsResponseSchema.parse(schools.map(serializeDates))
    },
  )

  app.get(
    '/schools/:schoolId',
    { preHandler: authenticate },
    async (request) => {
      const user = authenticatedUser(request)
      const { schoolId } = schoolParams.parse(request.params)
      const school = await schoolService(getStore()).findSchool(schoolId)
      if (!(await getAccess().canViewSchool(user.id, school))) {
        throw new RecordNotFound('SCHOOL_NOT_FOUND')
      }
      return SchoolSchema.parse(serializeDates(school))
    },
  )
}
