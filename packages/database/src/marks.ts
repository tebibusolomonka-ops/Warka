import {
  Prisma,
  type Assessment,
  type Enrollment,
  type Mark,
  type PrismaClient,
} from '@prisma/client'
import { z } from 'zod'
import { findAssessmentById } from './assessments.js'
import { findEnrollmentById } from './enrollments.js'
import { hasOrganizationAdminRole } from './organizationMemberships.js'
import { findSchoolMembership } from './schoolMemberships.js'
import { mayManageClassSubject } from './teachingAssignments.js'
import { assertResultSetDraft } from './results.js'
import { assertMarkEntryWindow } from './markEntryWindows.js'
import { recordAuditEvent } from './auditEvents.js'

export const RecordMarkSchema = z.object({
  schoolId: z.uuid(),
  enrollmentId: z.uuid(),
  assessmentId: z.uuid(),
  score: z.string().regex(/^\d{1,6}(\.\d{1,2})?$/),
  overrideReason: z.string().trim().min(5).max(200).optional(),
})

export type RecordMark = z.input<typeof RecordMarkSchema>

export class InvalidMarkContextError extends Error {
  constructor() {
    super('Enrollment and assessment must match an approved class enrollment')
  }
}

export class MarkPermissionError extends Error {
  constructor() {
    super('User cannot manage marks for this class subject')
  }
}

export class InvalidMarkScoreError extends Error {
  constructor() {
    super('Score must be between zero and the assessment maximum')
  }
}

export class DuplicateMarkError extends Error {
  constructor() {
    super('A mark already exists for this enrollment and assessment')
  }
}

export class MarkNotFoundError extends Error {
  constructor() {
    super('Mark not found')
  }
}

export async function canRecordAssessment(
  database: PrismaClient,
  actorId: string,
  assessment: Assessment,
): Promise<boolean> {
  const school = await database.school.findUnique({
    where: { id: assessment.schoolId },
    select: { organizationId: true },
  })
  if (!school) return false
  if (
    await hasOrganizationAdminRole(database, actorId, school.organizationId)
  ) {
    return true
  }
  const membership = await findSchoolMembership(
    database,
    actorId,
    assessment.schoolId,
  )
  if (membership?.role === 'administrator') return true
  if (membership?.role !== 'teacher') return false
  return mayManageClassSubject(
    database,
    actorId,
    assessment.schoolId,
    assessment.academicYearId,
    assessment.schoolClassId,
    assessment.subjectId,
  )
}

async function validMarkContext(
  database: PrismaClient,
  actorId: string,
  input: RecordMark,
): Promise<{
  assessment: Assessment
  enrollment: Enrollment
  score: Prisma.Decimal
  usedOverride: boolean
}> {
  const data = RecordMarkSchema.parse(input)
  z.uuid().parse(actorId)
  const [assessment, enrollment] = await Promise.all([
    findAssessmentById(database, data.schoolId, data.assessmentId),
    findEnrollmentById(database, data.schoolId, data.enrollmentId),
  ])
  if (
    !assessment ||
    !enrollment ||
    enrollment.status !== 'approved' ||
    enrollment.academicYearId !== assessment.academicYearId ||
    enrollment.schoolClassId !== assessment.schoolClassId
  ) {
    throw new InvalidMarkContextError()
  }
  if (!(await canRecordAssessment(database, actorId, assessment))) {
    throw new MarkPermissionError()
  }
  await assertResultSetDraft(database, assessment)
  const usedOverride = await assertMarkEntryWindow(
    database,
    actorId,
    assessment,
    data.overrideReason,
  )
  const score = new Prisma.Decimal(data.score)
  if (score.lt(0) || score.gt(assessment.maximumScore)) {
    throw new InvalidMarkScoreError()
  }
  return { assessment, enrollment, score, usedOverride }
}

export async function recordMark(
  database: PrismaClient,
  actorId: string,
  input: RecordMark,
): Promise<Mark> {
  const { assessment, enrollment, score, usedOverride } =
    await validMarkContext(database, actorId, input)
  try {
    const create = (client: PrismaClient | Prisma.TransactionClient) =>
      client.mark.create({
        data: {
          schoolId: assessment.schoolId,
          studentId: enrollment.studentId,
          enrollmentId: enrollment.id,
          assessmentId: assessment.id,
          score,
          recordedById: actorId,
        },
      })
    if (!usedOverride) return await create(database)
    return await database.$transaction(async (transaction) => {
      const mark = await create(transaction)
      await recordAuditEvent(transaction, {
        schoolId: assessment.schoolId,
        actorUserId: actorId,
        action: 'mark.windowOverridden',
        resourceType: 'mark',
        resourceId: mark.id,
        metadata: { reason: input.overrideReason ?? '' },
      })
      return mark
    })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new DuplicateMarkError()
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2003'
    ) {
      throw new InvalidMarkContextError()
    }
    throw error
  }
}

export async function updateDraftMark(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  markId: string,
  score: string,
  overrideReason?: string,
): Promise<Mark> {
  const mark = await database.mark.findFirst({
    where: { id: markId, schoolId },
  })
  if (!mark) throw new MarkNotFoundError()
  const checked = await validMarkContext(database, actorId, {
    schoolId,
    enrollmentId: mark.enrollmentId,
    assessmentId: mark.assessmentId,
    score,
    ...(overrideReason ? { overrideReason } : {}),
  })
  if (!checked.usedOverride)
    return database.mark.update({
      where: { id: mark.id },
      data: { score: checked.score, recordedById: actorId },
    })
  return database.$transaction(async (transaction) => {
    const updated = await transaction.mark.update({
      where: { id: mark.id },
      data: { score: checked.score, recordedById: actorId },
    })
    await recordAuditEvent(transaction, {
      schoolId,
      actorUserId: actorId,
      action: 'mark.windowOverridden',
      resourceType: 'mark',
      resourceId: updated.id,
      metadata: { reason: overrideReason ?? '' },
    })
    return updated
  })
}

export function getMarksForAssessment(
  database: PrismaClient,
  schoolId: string,
  assessmentId: string,
): Promise<Mark[]> {
  return database.mark.findMany({
    where: { schoolId, assessmentId },
    orderBy: [{ studentId: 'asc' }, { id: 'asc' }],
  })
}

export function getMarksForStudentContext(
  database: PrismaClient,
  schoolId: string,
  enrollmentId: string,
  gradingPeriodId: string,
  subjectId: string,
): Promise<Mark[]> {
  return database.mark.findMany({
    where: {
      schoolId,
      enrollmentId,
      assessment: { gradingPeriodId, subjectId },
    },
    orderBy: [{ assessment: { position: 'asc' } }, { assessmentId: 'asc' }],
  })
}
