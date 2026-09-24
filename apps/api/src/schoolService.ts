import {
  createOrganization,
  createSchool,
  findOrganizationById,
  findSchoolById,
  listSchoolsForOrganization,
  type CreateOrganization,
  type CreateSchool,
  type Organization,
  type PrismaClient,
  type School,
} from '@warka/database'

export type SchoolStore = {
  createOrganization(data: CreateOrganization): Promise<Organization>
  findOrganizationById(id: string): Promise<Organization | null>
  createSchool(data: CreateSchool): Promise<School>
  findSchoolById(id: string): Promise<School | null>
  listSchoolsForOrganization(organizationId: string): Promise<School[]>
}

export function prismaSchoolStore(database: PrismaClient): SchoolStore {
  return {
    createOrganization: (data) => createOrganization(database, data),
    findOrganizationById: (id) => findOrganizationById(database, id),
    createSchool: (data) => createSchool(database, data),
    findSchoolById: (id) => findSchoolById(database, id),
    listSchoolsForOrganization: (id) =>
      listSchoolsForOrganization(database, id),
  }
}

export class RecordNotFound extends Error {
  constructor(
    public readonly code: 'ORGANIZATION_NOT_FOUND' | 'SCHOOL_NOT_FOUND',
  ) {
    super(
      code === 'ORGANIZATION_NOT_FOUND'
        ? 'Organization not found'
        : 'School not found',
    )
  }
}

export function schoolService(store: SchoolStore) {
  return {
    createOrganization: (name: string) => store.createOrganization({ name }),
    async createSchool(organizationId: string, name: string) {
      if (!(await store.findOrganizationById(organizationId))) {
        throw new RecordNotFound('ORGANIZATION_NOT_FOUND')
      }
      return store.createSchool({ organizationId, name })
    },
    async listSchools(organizationId: string) {
      if (!(await store.findOrganizationById(organizationId))) {
        throw new RecordNotFound('ORGANIZATION_NOT_FOUND')
      }
      return store.listSchoolsForOrganization(organizationId)
    },
    async findSchool(schoolId: string) {
      const school = await store.findSchoolById(schoolId)
      if (!school) {
        throw new RecordNotFound('SCHOOL_NOT_FOUND')
      }
      return school
    },
  }
}
