import { Prisma, type PrismaClient } from '@prisma/client'
import { z } from 'zod'
import {
  assertAttendanceManager,
  AttendancePermissionError,
} from './attendanceAuthorization.js'

export const AttendanceCorrectionInputSchema = z.strictObject({
  recordId: z.uuid(),
  newStatus: z.enum(['present', 'absent', 'late', 'excused']),
  reason: z.string().trim().min(8).max(500),
})
export class AttendanceCorrectionError extends Error {}

export async function correctAttendance(
  database: PrismaClient,
  actorId: string,
  input: z.input<typeof AttendanceCorrectionInputSchema>,
) {
  z.uuid().parse(actorId)
  const value = AttendanceCorrectionInputSchema.parse(input)
  return database.$transaction(
    async (transaction) => {
      const record = await transaction.studentAttendanceRecord.findUnique({
        where: { id: value.recordId },
        include: { session: true },
      })
      if (!record || record.session.status === 'cancelled')
        throw new AttendanceCorrectionError('Attendance record unavailable')
      await assertAttendanceManager(
        transaction as PrismaClient,
        actorId,
        record.session,
        record.session.date,
      )
      if (record.session.status === 'finalized') {
        const membership = await transaction.schoolMembership.findUnique({
          where: {
            userId_schoolId: { userId: actorId, schoolId: record.schoolId },
          },
        })
        if (membership?.role !== 'administrator')
          throw new AttendancePermissionError()
      }
      if (record.status === value.newStatus)
        throw new AttendanceCorrectionError('Status is unchanged')
      const correction = await transaction.attendanceCorrection.create({
        data: {
          recordId: record.id,
          previousStatus: record.status,
          newStatus: value.newStatus,
          reason: value.reason,
          performedById: actorId,
          approvedById: record.session.status === 'finalized' ? actorId : null,
        },
      })
      await transaction.studentAttendanceRecord.update({
        where: { id: record.id },
        data: { status: value.newStatus, recordedById: actorId },
      })
      if (record.session.status === 'finalized')
        await transaction.auditEvent.create({
          data: {
            schoolId: record.schoolId,
            actorUserId: actorId,
            action: 'attendance.corrected',
            resourceType: 'StudentAttendanceRecord',
            resourceId: record.id,
            metadata: {
              previousStatus: record.status,
              newStatus: value.newStatus,
              correctionId: correction.id,
            },
          },
        })
      return correction
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
}
