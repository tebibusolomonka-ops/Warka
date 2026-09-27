import type { PrismaClient, PrivacyRequesterKind } from '@prisma/client'
import { z } from 'zod'
import { notifyPrivacyRequester } from './privacyNotifications.js'

export const PrivacyRequestInputSchema = z
  .strictObject({
    schoolId: z.uuid(),
    studentId: z.uuid(),
    type: z.enum(['access', 'correction', 'restriction', 'objection']),
    details: z.string().trim().min(3).max(1000),
    correctionField: z
      .enum(['givenName', 'familyName', 'dateOfBirth'])
      .optional(),
    correctionValue: z.string().trim().max(100).nullable().optional(),
    restrictionCategory: z
      .enum(['parentPortalSharing', 'publicDocumentVerification'])
      .optional(),
  })
  .superRefine((value, context) => {
    if (
      value.type === 'correction' &&
      (!value.correctionField || value.correctionValue === undefined)
    )
      context.addIssue({
        code: 'custom',
        path: ['correctionField'],
        message: 'Correction field and value are required',
      })
    if (
      value.type !== 'correction' &&
      (value.correctionField || value.correctionValue !== undefined)
    )
      context.addIssue({
        code: 'custom',
        path: ['correctionField'],
        message: 'Correction fields require a correction request',
      })
    if (value.type === 'restriction' && !value.restrictionCategory)
      context.addIssue({
        code: 'custom',
        path: ['restrictionCategory'],
        message: 'Restriction category is required',
      })
    if (value.type !== 'restriction' && value.restrictionCategory)
      context.addIssue({
        code: 'custom',
        path: ['restrictionCategory'],
        message: 'Restriction category requires a restriction request',
      })
  })

export class PrivacyPermissionError extends Error {
  constructor() {
    super('Privacy request access denied')
  }
}

export async function privacyRequesterScope(
  database: Pick<
    PrismaClient,
    'student' | 'studentAccess' | 'guardianAccess' | 'studentGuardian'
  >,
  userId: string,
  studentId: string,
  schoolId: string,
): Promise<PrivacyRequesterKind> {
  z.uuid().parse(userId)
  z.uuid().parse(studentId)
  z.uuid().parse(schoolId)
  const student = await database.student.findFirst({
    where: { id: studentId, enrollments: { some: { schoolId } } },
    select: { id: true },
  })
  if (!student) throw new PrivacyPermissionError()
  const self = await database.studentAccess.findUnique({ where: { userId } })
  if (self?.studentId === studentId) return 'student'
  const guardian = await database.guardianAccess.findUnique({
    where: { userId },
  })
  if (!guardian) throw new PrivacyPermissionError()
  const relationship = await database.studentGuardian.findFirst({
    where: {
      studentId,
      guardianId: guardian.guardianId,
      verificationStatus: 'verified',
      verificationSchoolId: schoolId,
      revokedAt: null,
    },
    select: { studentId: true },
  })
  if (!relationship) throw new PrivacyPermissionError()
  return 'guardian'
}

export async function createPrivacyRequest(
  database: PrismaClient,
  requesterUserId: string,
  input: unknown,
) {
  z.uuid().parse(requesterUserId)
  const data = PrivacyRequestInputSchema.parse(input)
  const requesterKind = await privacyRequesterScope(
    database,
    requesterUserId,
    data.studentId,
    data.schoolId,
  )
  const request = await database.privacyRequest.create({
    data: {
      schoolId: data.schoolId,
      studentId: data.studentId,
      requesterUserId,
      requesterKind,
      type: data.type,
      details: data.details,
      correctionField: data.correctionField ?? null,
      correctionValue: data.correctionValue ?? null,
      restrictionCategory: data.restrictionCategory ?? null,
    },
  })
  await notifyPrivacyRequester(
    database,
    requesterUserId,
    request.id,
    'submitted',
  )
  return request
}

export async function listOwnPrivacyRequests(
  database: PrismaClient,
  requesterUserId: string,
  take = 25,
  skip = 0,
) {
  z.uuid().parse(requesterUserId)
  const pageSize = z.number().int().min(1).max(50).parse(take)
  const offset = z.number().int().min(0).max(100000).parse(skip)
  const where = { requesterUserId }
  return {
    total: await database.privacyRequest.count({ where }),
    items: await database.privacyRequest.findMany({
      where,
      take: pageSize,
      skip: offset,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        schoolId: true,
        studentId: true,
        type: true,
        status: true,
        details: true,
        correctionField: true,
        restrictionCategory: true,
        officialCorrectionRequestId: true,
        createdAt: true,
        reviewedAt: true,
        reviewReason: true,
        fulfilledAt: true,
      },
    }),
    take: pageSize,
    skip: offset,
  }
}
