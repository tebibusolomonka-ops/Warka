import { Prisma, type PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { checkStudentDataQuality } from './studentDataQuality.js'
import { checkEnrollmentDataQuality } from './enrollmentDataQuality.js'
import { checkAcademicDataQuality } from './academicDataQuality.js'
import { checkDocumentDataQuality } from './documentDataQuality.js'
import { requireDataQualityAdministrator } from './dataQualityIssues.js'

export class DataQualityRunConflictError extends Error {}
export const DataQualityRunInputSchema = z.strictObject({
  schoolId: z.uuid(),
  trigger: z.enum(['manual', 'scheduled', 'reportingValidation']),
  checks: z
    .array(z.enum(['student', 'enrollment', 'academic', 'document']))
    .min(1)
    .max(4),
})
type Input = z.input<typeof DataQualityRunInputSchema>

export async function evaluateDataQuality(
  database: PrismaClient,
  input: Input,
  actorId?: string,
) {
  const value = DataQualityRunInputSchema.parse(input)
  if (new Set(value.checks).size !== value.checks.length)
    throw new DataQualityRunConflictError('Duplicate quality check')
  if (value.trigger === 'manual') {
    if (!actorId)
      throw new DataQualityRunConflictError(
        'Manual evaluation requires an actor',
      )
    await requireDataQualityAdministrator(database, actorId, value.schoolId)
  }
  let run
  try {
    run = await database.dataQualityRun.create({
      data: {
        schoolId: value.schoolId,
        trigger: value.trigger,
        checksExecuted: value.checks,
      },
    })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    )
      throw new DataQualityRunConflictError(
        'Evaluation already running for school',
      )
    throw error
  }
  try {
    const functions = {
      student: checkStudentDataQuality,
      enrollment: checkEnrollmentDataQuality,
      academic: checkAcademicDataQuality,
      document: checkDocumentDataQuality,
    }
    const findings = (
      await Promise.all(
        value.checks.map((check) => functions[check](database, value.schoolId)),
      )
    ).flat()
    const keys = new Set(
      findings.map(
        (finding) =>
          `${finding.code}:${finding.entityType}:${finding.entityId}`,
      ),
    )
    return await database.$transaction(
      async (transaction) => {
        const open = await transaction.dataQualityIssue.findMany({
          where: {
            schoolId: value.schoolId,
            status: 'open',
            category: { in: value.checks },
          },
        })
        for (const issue of open)
          if (!keys.has(`${issue.code}:${issue.entityType}:${issue.entityId}`))
            await transaction.dataQualityIssue.update({
              where: { id: issue.id },
              data: { status: 'resolved', resolvedAt: new Date() },
            })
        const existing = await transaction.dataQualityIssue.findMany({
          where: { schoolId: value.schoolId, category: { in: value.checks } },
          orderBy: { detectedAt: 'desc' },
        })
        const latest = new Map(
          existing.map((issue) => [
            `${issue.code}:${issue.entityType}:${issue.entityId}`,
            issue,
          ]),
        )
        for (const finding of findings) {
          const key = `${finding.code}:${finding.entityType}:${finding.entityId}`
          const prior = latest.get(key)
          if (prior?.status === 'open' || prior?.status === 'dismissed')
            continue
          const created = await transaction.dataQualityIssue.create({
            data: {
              schoolId: value.schoolId,
              category: finding.category,
              severity: finding.severity,
              code: finding.code,
              summary: finding.summary,
              entityType: finding.entityType,
              entityId: finding.entityId,
            },
          })
          latest.set(key, created)
        }
        const counts = { info: 0, warning: 0, blocking: 0 }
        for (const finding of findings) counts[finding.severity] += 1
        return transaction.dataQualityRun.update({
          where: { id: run.id },
          data: {
            status: 'completed',
            completedAt: new Date(),
            infoCount: counts.info,
            warningCount: counts.warning,
            blockingCount: counts.blocking,
          },
        })
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    )
  } catch (error) {
    await database.dataQualityRun.update({
      where: { id: run.id },
      data: {
        status: 'failed',
        completedAt: new Date(),
        failureCode: 'QUALITY_CHECK_FAILED',
      },
    })
    throw error
  }
}
