import type { FastifyInstance } from 'fastify'
import {
  CreateOrganizationSchema,
  CreateSchoolSchema,
  OrganizationSchema,
  SchoolSchema,
  SchoolsResponseSchema,
} from '@warka/shared'
import { z } from 'zod'
import { schoolService, type SchoolStore } from './schoolService.js'

const organizationParams = z.object({ organizationId: z.uuid() })
const schoolParams = z.object({ schoolId: z.uuid() })

function serializeDates<T extends { createdAt: Date; updatedAt: Date }>(record: T) {
  return {
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

export function registerSchoolRoutes(app: FastifyInstance, getStore: () => SchoolStore) {
  app.post('/organizations', async (request, reply) => {
    const { name } = CreateOrganizationSchema.parse(request.body)
    const organization = await schoolService(getStore()).createOrganization(name)
    return reply.code(201).send(OrganizationSchema.parse(serializeDates(organization)))
  })

  app.post('/organizations/:organizationId/schools', async (request, reply) => {
    const { organizationId } = organizationParams.parse(request.params)
    const { name } = CreateSchoolSchema.parse(request.body)
    const school = await schoolService(getStore()).createSchool(organizationId, name)
    return reply.code(201).send(SchoolSchema.parse(serializeDates(school)))
  })

  app.get('/organizations/:organizationId/schools', async (request) => {
    const { organizationId } = organizationParams.parse(request.params)
    const schools = await schoolService(getStore()).listSchools(organizationId)
    return SchoolsResponseSchema.parse(schools.map(serializeDates))
  })

  app.get('/schools/:schoolId', async (request) => {
    const { schoolId } = schoolParams.parse(request.params)
    const school = await schoolService(getStore()).findSchool(schoolId)
    return SchoolSchema.parse(serializeDates(school))
  })
}
