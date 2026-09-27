import { z } from 'zod'
import { requestJson } from './api'

export const searchType = z.enum([
  'student',
  'staff',
  'issuedDocument',
  'documentRequest',
  'transfer',
  'supportRequest',
  'incident',
])
export type SearchType = z.infer<typeof searchType>
const result = z.object({
  type: searchType,
  title: z.string(),
  subtitle: z.string(),
  reference: z.string(),
  schoolId: z.uuid(),
})
export type SearchResult = z.infer<typeof result>
const response = z.object({
  groups: z.partialRecord(searchType, z.array(result)),
  limit: z.number(),
  offset: z.number(),
})
export async function searchSchool(
  baseUrl: string,
  schoolId: string,
  q: string,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({ schoolId, q, limit: '10' })
  return response.parse(
    await requestJson(baseUrl, `/search?${params}`, signal ? { signal } : {}),
  )
}
const opened = z.object({
  type: searchType,
  title: z.string(),
  reference: z.string(),
  status: z.string().optional(),
  studentReference: z.string().optional(),
  category: z.string().optional(),
})
export type OpenedSearchResult = z.infer<typeof opened>
export async function openSearchResult(
  baseUrl: string,
  item: SearchResult,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({
    schoolId: item.schoolId,
    type: item.type,
    reference: item.reference,
  })
  return opened.parse(
    await requestJson(
      baseUrl,
      `/search/open?${params}`,
      signal ? { signal } : {},
    ),
  )
}
