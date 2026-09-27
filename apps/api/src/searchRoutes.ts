import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import type { PrismaClient } from '@warka/database'
import { z } from 'zod'
import { authenticatedUser } from './authenticateRequest.js'
import {
  searchStudents,
  searchStaff,
  searchSchoolScope,
  SearchAccessError,
  SearchTypeSchema,
  type SchoolSearchResult,
  type SearchType,
} from './schoolSearch.js'
import { searchDocumentsAndTransfers } from './documentTransferSearch.js'
import { searchSupportAndOperations } from './supportOperationsSearch.js'
import { requireOperator } from './operationsAccess.js'

const querySchema = z.strictObject({
  q: z.string().trim().min(2).max(100),
  schoolId: z.uuid(),
  types: z.string().max(150).optional(),
  limit: z.coerce.number().int().min(1).max(20).default(10),
  offset: z.coerce.number().int().min(0).max(500).default(0),
})

export async function unifiedSchoolSearch(
  database: PrismaClient,
  input: {
    actorId: string
    schoolId: string
    query: string
    types?: SearchType[]
    limit: number
    offset: number
  },
) {
  const scope = await searchSchoolScope(database, input.actorId, input.schoolId)
  const types = input.types ?? scope.allowedTypes
  for (const type of types) {
    if (type === 'incident') await requireOperator(database, input.actorId)
    else if (!scope.allowedTypes.includes(type)) throw new SearchAccessError()
  }
  const perTypeLimit = Math.min(
    input.limit,
    Math.max(1, Math.floor(50 / Math.max(types.length, 1))),
  )
  const groups: Partial<Record<SearchType, SchoolSearchResult[]>> = {}
  for (const type of types) {
    const search = { ...input, types: [type], limit: perTypeLimit }
    groups[type] =
      type === 'student'
        ? await searchStudents(database, search)
        : type === 'staff'
          ? await searchStaff(database, search)
          : ['issuedDocument', 'documentRequest', 'transfer'].includes(type)
            ? await searchDocumentsAndTransfers(database, search)
            : await searchSupportAndOperations(database, search)
  }
  return { groups, limit: perTypeLimit, offset: input.offset }
}

export function registerSearchRoutes(
  app: FastifyInstance,
  getDatabase: () => PrismaClient,
  authenticate: preHandlerHookHandler,
  search: typeof unifiedSchoolSearch = unifiedSchoolSearch,
) {
  const buckets = new Map<string, { started: number; count: number }>()
  app.get('/search', { preHandler: authenticate }, async (request, reply) => {
    const actorId = authenticatedUser(request).id
    const params = querySchema.parse(request.query)
    const types = params.types
      ? [
          ...new Set(
            params.types
              .split(',')
              .map((value) => SearchTypeSchema.parse(value)),
          ),
        ]
      : undefined
    const now = Date.now()
    const existing = buckets.get(actorId)
    const bucket =
      existing && now - existing.started < 60_000
        ? existing
        : { started: now, count: 0 }
    bucket.count++
    buckets.set(actorId, bucket)
    if (buckets.size > 10_000)
      for (const [key, value] of buckets)
        if (now - value.started >= 60_000) buckets.delete(key)
    if (bucket.count > 30)
      return reply
        .code(429)
        .send({
          error: {
            code: 'SEARCH_RATE_LIMIT',
            message: 'Search rate limit exceeded',
          },
        })
    try {
      const result = await search(getDatabase(), {
        actorId,
        schoolId: params.schoolId,
        query: params.q,
        ...(types ? { types } : {}),
        limit: params.limit,
        offset: params.offset,
      })
      return reply.header('Cache-Control', 'private, no-store').send(result)
    } catch (error) {
      if (error instanceof SearchAccessError)
        return reply
          .code(403)
          .send({
            error: {
              code: 'SEARCH_ACCESS_DENIED',
              message: 'Search access denied',
            },
          })
      throw error
    }
  })
}
