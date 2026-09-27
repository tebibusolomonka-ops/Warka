import type { PrismaClient } from '@warka/database'
import { z } from 'zod'
import {
  literalSearchTerm,
  SearchAccessError,
  searchSchoolScope,
  validatedSearchInput,
  type SchoolSearchResult,
  type SearchInput,
} from './schoolSearch.js'

const documentType = z.enum(['reportCard', 'transcript'])
const requestStatus = z.enum([
  'requested',
  'processing',
  'ready',
  'rejected',
  'cancelled',
])
const transferStatus = z.enum([
  'requested',
  'approvedBySendingSchool',
  'acceptedByReceivingSchool',
  'rejected',
  'cancelled',
])

export async function searchDocumentsAndTransfers(
  database: PrismaClient,
  input: SearchInput,
): Promise<SchoolSearchResult[]> {
  const search = validatedSearchInput(input)
  const scope = await searchSchoolScope(
    database,
    search.actorId,
    search.schoolId,
  )
  for (const type of search.types)
    if (!scope.allowedTypes.includes(type)) throw new SearchAccessError()
  const term = literalSearchTerm(search.query)
  const docType = documentType.safeParse(search.query)
  const reqStatus = requestStatus.safeParse(search.query)
  const transferState = transferStatus.safeParse(search.query)
  const results: SchoolSearchResult[] = []
  if (search.types.includes('issuedDocument')) {
    const documents = await database.issuedDocument.findMany({
      where: {
        schoolId: search.schoolId,
        OR: [
          { verificationReference: { contains: term, mode: 'insensitive' } },
          {
            student: {
              studentReference: { contains: term, mode: 'insensitive' },
            },
          },
          ...(docType.success ? [{ documentType: docType.data }] : []),
        ],
      },
      orderBy: [{ issuedAt: 'desc' }, { id: 'desc' }],
      skip: search.offset,
      take: search.limit,
      select: {
        verificationReference: true,
        documentType: true,
        status: true,
        student: { select: { studentReference: true } },
      },
    })
    results.push(
      ...documents.map((item) => ({
        type: 'issuedDocument' as const,
        title: `${item.documentType} · ${item.student.studentReference}`,
        subtitle: item.status,
        reference: item.verificationReference,
        schoolId: search.schoolId,
      })),
    )
  }
  if (search.types.includes('documentRequest')) {
    const requests = await database.documentRequest.findMany({
      where: {
        schoolId: search.schoolId,
        OR: [
          {
            student: {
              studentReference: { contains: term, mode: 'insensitive' },
            },
          },
          ...(docType.success ? [{ documentType: docType.data }] : []),
          ...(reqStatus.success ? [{ status: reqStatus.data }] : []),
        ],
      },
      orderBy: [{ requestedAt: 'desc' }, { id: 'desc' }],
      skip: search.offset,
      take: search.limit,
      select: {
        id: true,
        documentType: true,
        status: true,
        student: { select: { studentReference: true } },
      },
    })
    results.push(
      ...requests.map((item) => ({
        type: 'documentRequest' as const,
        title: `${item.documentType} request · ${item.student.studentReference}`,
        subtitle: item.status,
        reference: item.id,
        schoolId: search.schoolId,
      })),
    )
  }
  if (search.types.includes('transfer')) {
    const transfers = await database.transferRequest.findMany({
      where: {
        AND: [
          {
            OR: [
              { sendingSchoolId: search.schoolId },
              { receivingSchoolId: search.schoolId },
            ],
          },
          {
            OR: [
              {
                student: {
                  studentReference: { contains: term, mode: 'insensitive' },
                },
              },
              ...(transferState.success
                ? [{ status: transferState.data }]
                : []),
            ],
          },
        ],
      },
      orderBy: [{ requestedAt: 'desc' }, { id: 'desc' }],
      skip: search.offset,
      take: search.limit,
      select: {
        id: true,
        status: true,
        student: { select: { studentReference: true } },
      },
    })
    results.push(
      ...transfers.map((item) => ({
        type: 'transfer' as const,
        title: `Transfer · ${item.student.studentReference}`,
        subtitle: item.status,
        reference: item.id,
        schoolId: search.schoolId,
      })),
    )
  }
  return results
}
