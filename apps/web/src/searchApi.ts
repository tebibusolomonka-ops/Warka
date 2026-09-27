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
