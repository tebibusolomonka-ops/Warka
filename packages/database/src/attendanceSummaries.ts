import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'

export const AttendanceSummaryInputSchema = z.strictObject({
  schoolId: z.uuid(),
  academicYearId: z.uuid(),
  schoolClassId: z.uuid().optional(),
  studentId: z.uuid().optional(),
})

export async function getAttendanceSummary(
  database: PrismaClient,
  input: z.input<typeof AttendanceSummaryInputSchema>,
) {
  const value = AttendanceSummaryInputSchema.parse(input)
  const enrollments = await database.enrollment.findMany({
    where: {
      schoolId: value.schoolId,
      academicYearId: value.academicYearId,
      status: 'approved',
      ...(value.schoolClassId ? { schoolClassId: value.schoolClassId } : {}),
      ...(value.studentId ? { studentId: value.studentId } : {}),
    },
    select: { schoolClassId: true, studentId: true },
  })
  const eligibleByClass = new Map<string, Set<string>>()
  for (const enrollment of enrollments) {
    if (!enrollment.schoolClassId) continue
    const students =
      eligibleByClass.get(enrollment.schoolClassId) ?? new Set<string>()
    students.add(enrollment.studentId)
    eligibleByClass.set(enrollment.schoolClassId, students)
  }
  const sessions = await database.attendanceSession.findMany({
    where: {
      schoolId: value.schoolId,
      academicYearId: value.academicYearId,
      ...(value.schoolClassId ? { schoolClassId: value.schoolClassId } : {}),
      status: { in: ['open', 'submitted', 'finalized'] },
    },
    select: {
      id: true,
      schoolClassId: true,
      status: true,
      records: { select: { studentId: true, status: true } },
    },
  })
  const counts = {
    instructionalSessionsRecorded: 0,
    incompleteSessions: 0,
    present: 0,
    absent: 0,
    late: 0,
    excused: 0,
    unrecorded: 0,
  }
  for (const session of sessions) {
    const eligible =
      eligibleByClass.get(session.schoolClassId) ?? new Set<string>()
    if (!eligible.size) continue
    if (session.status === 'open') counts.incompleteSessions++
    else counts.instructionalSessionsRecorded++
    const recorded = new Set<string>()
    for (const record of session.records) {
      if (!eligible.has(record.studentId)) continue
      recorded.add(record.studentId)
      counts[record.status]++
    }
    counts.unrecorded += eligible.size - recorded.size
  }
  return counts
}
