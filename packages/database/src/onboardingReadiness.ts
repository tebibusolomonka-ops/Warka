import type { PrismaClient } from '@prisma/client'
import { requireAcademicYearAdmin } from './academicYearClosing.js'
import { listOnboardingChecklist } from './onboardingChecklist.js'

export type ReadinessCheck = {
  key: string
  status: 'ready' | 'warning' | 'blocked'
  reason: string
}

export function summarizeReadiness(checks: ReadinessCheck[]) {
  return {
    status: checks.some((item) => item.status === 'blocked')
      ? ('blocked' as const)
      : checks.some((item) => item.status === 'warning')
        ? ('warning' as const)
        : ('ready' as const),
    checks,
  }
}

export async function evaluateSchoolReadiness(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
) {
  await requireAcademicYearAdmin(database, actorId, schoolId)
  const [checklist, primaryContacts, requirements, submissions] =
    await Promise.all([
      listOnboardingChecklist(database, actorId, schoolId),
      database.schoolContact.count({ where: { schoolId, role: 'primary' } }),
      database.reportingRequirement.count({ where: { schoolId } }),
      database.reportingSubmission.count({ where: { schoolId } }),
    ])
  const reasons: Record<string, string> = {
    documentProfile: 'School document profile is not configured',
    administrator: 'No school administrator is assigned',
    academicYear: 'No academic year is configured',
    gradeLevels: 'No grade levels are configured',
    classes: 'No classes are configured',
    subjects: 'No subjects are configured',
    gradingScheme: 'No grading scheme is configured',
    staffAssignments: 'No teaching assignments are configured',
  }
  const checks: ReadinessCheck[] = checklist
    .filter((item) => item.source === 'system')
    .map((item) => ({
      key: item.key,
      status:
        item.status === 'complete'
          ? 'ready'
          : item.key === 'documentProfile' || item.key === 'staffAssignments'
            ? 'warning'
            : 'blocked',
      reason:
        item.status === 'complete'
          ? `${item.key} configured`
          : (reasons[item.key] ?? 'Configuration incomplete'),
    }))
  checks.push({
    key: 'primaryContact',
    status: primaryContacts > 0 ? 'ready' : 'warning',
    reason:
      primaryContacts > 0
        ? 'Primary operational contact recorded'
        : 'No primary operational contact recorded',
  })
  if (requirements > 0)
    checks.push({
      key: 'reporting',
      status: submissions > 0 ? 'ready' : 'warning',
      reason:
        submissions > 0
          ? 'Reporting submission exists'
          : 'School participates in reporting but has no submission yet',
    })
  return summarizeReadiness(checks)
}
