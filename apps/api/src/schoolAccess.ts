import {
  findSchoolMembership,
  hasOrganizationAdminRole,
  listOrganizationsForUser,
  type OrganizationAccess,
  type PrismaClient,
  type School,
} from '@warka/database'

export type SchoolAccess = {
  organizationsForUser(userId: string): Promise<OrganizationAccess[]>
  canManageOrganization(
    userId: string,
    organizationId: string,
  ): Promise<boolean>
  canViewSchool(userId: string, school: School): Promise<boolean>
}

export function createSchoolAccess(database: PrismaClient): SchoolAccess {
  return {
    organizationsForUser: (userId) =>
      listOrganizationsForUser(database, userId),
    canManageOrganization: (userId, organizationId) =>
      hasOrganizationAdminRole(database, userId, organizationId),
    async canViewSchool(userId, school) {
      if (
        await hasOrganizationAdminRole(database, userId, school.organizationId)
      ) {
        return true
      }
      return (await findSchoolMembership(database, userId, school.id)) !== null
    },
  }
}
