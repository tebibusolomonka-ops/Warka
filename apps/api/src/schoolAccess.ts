import {
  findSchoolMembership,
  hasOrganizationAdminRole,
  listOrganizationsForUser,
  type OrganizationAccess,
  type PrismaClient,
  type School,
  type SchoolRole,
} from '@warka/database'

export type SchoolAccess = {
  organizationsForUser(userId: string): Promise<OrganizationAccess[]>
  canManageOrganization(
    userId: string,
    organizationId: string,
  ): Promise<boolean>
  canViewSchool(userId: string, school: School): Promise<boolean>
  canRegisterStudents(userId: string, school: School): Promise<boolean>
  canSubmitEnrollment(userId: string, school: School): Promise<boolean>
  canApproveEnrollment(userId: string, school: School): Promise<boolean>
  canWithdrawEnrollment(userId: string, school: School): Promise<boolean>
}

export function createSchoolAccess(database: PrismaClient): SchoolAccess {
  async function hasSchoolPermission(
    userId: string,
    school: School,
    roles: readonly SchoolRole[],
  ): Promise<boolean> {
    if (
      await hasOrganizationAdminRole(database, userId, school.organizationId)
    ) {
      return true
    }
    const membership = await findSchoolMembership(database, userId, school.id)
    return membership !== null && roles.includes(membership.role)
  }

  return {
    organizationsForUser: (userId) =>
      listOrganizationsForUser(database, userId),
    canManageOrganization: (userId, organizationId) =>
      hasOrganizationAdminRole(database, userId, organizationId),
    canViewSchool: (userId, school) =>
      hasSchoolPermission(userId, school, [
        'administrator',
        'registrar',
        'teacher',
        'approver',
      ]),
    canRegisterStudents: (userId, school) =>
      hasSchoolPermission(userId, school, ['administrator', 'registrar']),
    canSubmitEnrollment: (userId, school) =>
      hasSchoolPermission(userId, school, ['administrator', 'registrar']),
    canApproveEnrollment: (userId, school) =>
      hasSchoolPermission(userId, school, ['administrator', 'approver']),
    canWithdrawEnrollment: (userId, school) =>
      hasSchoolPermission(userId, school, ['administrator']),
  }
}
