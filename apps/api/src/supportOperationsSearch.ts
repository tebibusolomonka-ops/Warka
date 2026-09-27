import type { PrismaClient } from '@warka/database'
import { requireOperator } from './operationsAccess.js'
import {
  literalSearchTerm,
  SearchAccessError,
  searchSchoolScope,
  validatedSearchInput,
  type SchoolSearchResult,
  type SearchInput,
} from './schoolSearch.js'

export async function searchSupportAndOperations(
  database: PrismaClient,
  input: SearchInput,
): Promise<SchoolSearchResult[]> {
  const search = validatedSearchInput(input)
  const result: SchoolSearchResult[] = []
  if (search.types.includes('supportRequest')) {
    const scope = await searchSchoolScope(
      database,
      search.actorId,
      search.schoolId,
    )
    if (!scope.allowedTypes.includes('supportRequest'))
      throw new SearchAccessError()
    const requests = await database.supportRequest.findMany({
      where: {
        schoolId: search.schoolId,
        title: {
          contains: literalSearchTerm(search.query),
          mode: 'insensitive',
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: search.offset,
      take: search.limit,
      select: { id: true, title: true, status: true },
    })
    result.push(
      ...requests.map((item) => ({
        type: 'supportRequest' as const,
        title: item.title,
        subtitle: item.status,
        reference: item.id,
        schoolId: search.schoolId,
      })),
    )
  }
  if (search.types.includes('incident')) {
    await requireOperator(database, search.actorId)
    const incidents = await database.operationalIncident.findMany({
      where: {
        title: {
          contains: literalSearchTerm(search.query),
          mode: 'insensitive',
        },
      },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      skip: search.offset,
      take: search.limit,
      select: { id: true, title: true, status: true },
    })
    result.push(
      ...incidents.map((item) => ({
        type: 'incident' as const,
        title: item.title,
        subtitle: item.status,
        reference: item.id,
        schoolId: search.schoolId,
      })),
    )
  }
  return result
}
