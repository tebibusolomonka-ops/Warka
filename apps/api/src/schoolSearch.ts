import type { PrismaClient } from '@warka/database'
import { findSchoolMembership, hasOrganizationAdminRole } from '@warka/database'
import { z } from 'zod'

export const SearchTypeSchema = z.enum([
  'student',
  'staff',
  'issuedDocument',
  'documentRequest',
  'transfer',
  'supportRequest',
  'incident',
])
export type SearchType = z.infer<typeof SearchTypeSchema>
export type SchoolSearchResult = {
  type: SearchType
  title: string
  subtitle: string
  reference: string
  schoolId: string
}
export type SearchInput = {
  actorId: string
  schoolId: string
  query: string
  types: SearchType[]
  limit: number
  offset: number
}
export class SearchAccessError extends Error {
  constructor() {
    super('Search access denied')
  }
}

export async function searchSchoolScope(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
) {
  const school = await database.school.findUnique({
    where: { id: schoolId },
    select: { organizationId: true },
  })
  if (!school) throw new SearchAccessError()
  const user = await database.user.findUnique({
    where: { id: actorId },
    select: { accountStatus: true },
  })
  if (user?.accountStatus !== 'active') throw new SearchAccessError()
  const organizationAdmin = await hasOrganizationAdminRole(
    database,
    actorId,
    school.organizationId,
  )
  const membership = await findSchoolMembership(database, actorId, schoolId)
  if (!organizationAdmin && !membership) throw new SearchAccessError()
  const role = organizationAdmin ? 'organizationAdmin' : membership!.role
  return {
    schoolId,
    role,
    allowedTypes:
      role === 'organizationAdmin' || role === 'administrator'
        ? ([
            'student',
            'staff',
            'issuedDocument',
            'documentRequest',
            'transfer',
            'supportRequest',
          ] as SearchType[])
        : role === 'registrar' || role === 'approver'
          ? ([
              'student',
              'issuedDocument',
              'documentRequest',
              'transfer',
            ] as SearchType[])
          : ([] as SearchType[]),
  }
}

export function validatedSearchInput(input: SearchInput) {
  const query = input.query.trim()
  if (
    query.length < 2 ||
    query.length > 100 ||
    !Number.isInteger(input.limit) ||
    input.limit < 1 ||
    input.limit > 50 ||
    !Number.isInteger(input.offset) ||
    input.offset < 0
  )
    throw new Error('Invalid search parameters')
  return {
    ...input,
    query,
    types: [
      ...new Set(input.types.map((type) => SearchTypeSchema.parse(type))),
    ],
  }
}

export function literalSearchTerm(query: string) {
  return query.replace(/[\\%_]/g, (character) => `\\${character}`)
}

export async function searchStudents(
  database: PrismaClient,
  input: SearchInput,
): Promise<SchoolSearchResult[]> {
  const search = validatedSearchInput(input)
  const scope = await searchSchoolScope(
    database,
    search.actorId,
    search.schoolId,
  )
  if (!scope.allowedTypes.includes('student')) throw new SearchAccessError()
  const term = literalSearchTerm(search.query)
  const students = await database.student.findMany({
    where: {
      enrollments: { some: { schoolId: search.schoolId } },
      OR: [
        { studentReference: { contains: term, mode: 'insensitive' } },
        { givenName: { contains: term, mode: 'insensitive' } },
        { familyName: { contains: term, mode: 'insensitive' } },
      ],
    },
    orderBy: [{ studentReference: 'asc' }, { id: 'asc' }],
    skip: search.offset,
    take: search.limit,
    select: { studentReference: true, givenName: true, familyName: true },
  })
  return students.map((student) => ({
    type: 'student',
    title: [student.givenName, student.familyName].filter(Boolean).join(' '),
    subtitle: student.studentReference,
    reference: student.studentReference,
    schoolId: search.schoolId,
  }))
}

export async function searchStaff(
  database: PrismaClient,
  input: SearchInput,
): Promise<SchoolSearchResult[]> {
  const search = validatedSearchInput(input)
  const scope = await searchSchoolScope(
    database,
    search.actorId,
    search.schoolId,
  )
  if (!scope.allowedTypes.includes('staff')) throw new SearchAccessError()
  const term = literalSearchTerm(search.query)
  const roleTerm = z
    .enum(['administrator', 'registrar', 'teacher', 'approver'])
    .safeParse(search.query.toLowerCase())
  const memberships = await database.schoolMembership.findMany({
    where: {
      schoolId: search.schoolId,
      OR: [
        { user: { displayName: { contains: term, mode: 'insensitive' } } },
        { user: { email: { contains: term, mode: 'insensitive' } } },
        ...(roleTerm.success ? [{ role: roleTerm.data }] : []),
      ],
    },
    orderBy: [{ user: { displayName: 'asc' } }, { userId: 'asc' }],
    skip: search.offset,
    take: search.limit,
    select: {
      role: true,
      startsAt: true,
      endsAt: true,
      user: { select: { displayName: true, email: true, accountStatus: true } },
    },
  })
  const now = new Date()
  return memberships.map((membership) => ({
    type: 'staff',
    title: membership.user.displayName,
    subtitle: `${membership.role} · ${membership.user.accountStatus !== 'active' ? 'deactivated' : membership.startsAt > now ? 'upcoming' : membership.endsAt && membership.endsAt <= now ? 'expired' : 'active'}`,
    reference: membership.user.email,
    schoolId: search.schoolId,
  }))
}
