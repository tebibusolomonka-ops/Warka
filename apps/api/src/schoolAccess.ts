import {
  findSchoolMembership,
  hasOrganizationAdminRole,
  listOrganizationsForUser,
  listSchoolAssignmentsForUser,
  listSchoolsForOrganization,
  type OrganizationAccess,
  type PrismaClient,
  type School,
  type SchoolRole,
} from '@warka/database'

export type StudentCapabilities = {
  canRegister: boolean
  canSubmit: boolean
  canApprove: boolean
}

export type AccessibleSchool = {
  school: School
  capabilities: StudentCapabilities
}

export type SchoolAccess = {
  organizationsForUser(userId: string): Promise<OrganizationAccess[]>
  schoolsForUser(userId: string): Promise<AccessibleSchool[]>
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

function capabilities(role: SchoolRole): StudentCapabilities {
  return {
    canRegister: role === 'administrator' || role === 'registrar',
    canSubmit: role === 'administrator' || role === 'registrar',
    canApprove: role === 'administrator' || role === 'approver',
  }
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
    async schoolsForUser(userId) {
      const [organizations, assignments] = await Promise.all([
        listOrganizationsForUser(database, userId),
        listSchoolAssignmentsForUser(database, userId),
      ])
      const accessible = new Map<string, AccessibleSchool>()
      for (const { school, role } of assignments) {
        accessible.set(school.id, { school, capabilities: capabilities(role) })
      }
      for (const { organization } of organizations) {
        const schools = await listSchoolsForOrganization(
          database,
          organization.id,
        )
        for (const school of schools) {
          accessible.set(school.id, {
            school,
            capabilities: {
              canRegister: true,
              canSubmit: true,
              canApprove: true,
            },
          })
        }
      }
      return [...accessible.values()].sort(
        (left, right) =>
          left.school.name.localeCompare(right.school.name) ||
          left.school.id.localeCompare(right.school.id),
      )
    },
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
