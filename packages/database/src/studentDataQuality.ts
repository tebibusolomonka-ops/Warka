import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'

export type QualityFinding = {
  category: 'student' | 'enrollment' | 'academic' | 'document'
  severity: 'info' | 'warning' | 'blocking'
  code: string
  summary: string
  entityType: string
  entityId: string
}

export async function checkStudentDataQuality(
  database: PrismaClient,
  schoolId: string,
): Promise<QualityFinding[]> {
  z.uuid().parse(schoolId)
  const students = await database.student.findMany({
    where: { enrollments: { some: { schoolId } } },
    select: {
      id: true,
      studentReference: true,
      givenName: true,
      enrollments: { where: { schoolId }, select: { schoolId: true } },
    },
    orderBy: { id: 'asc' },
  })
  const findings: QualityFinding[] = []
  const references = new Map<string, string>()
  for (const student of students) {
    if (!student.studentReference.trim())
      findings.push({
        category: 'student',
        severity: 'blocking',
        code: 'STUDENT_REFERENCE_MISSING',
        summary: 'Internal student reference is missing',
        entityType: 'student',
        entityId: student.id,
      })
    else {
      const prior = references.get(student.studentReference.trim())
      if (prior && prior !== student.id)
        findings.push({
          category: 'student',
          severity: 'blocking',
          code: 'STUDENT_REFERENCE_CONFLICT',
          summary: 'Internal student reference conflicts with another record',
          entityType: 'student',
          entityId: student.id,
        })
      else references.set(student.studentReference.trim(), student.id)
    }
    if (!student.givenName.trim())
      findings.push({
        category: 'student',
        severity: 'warning',
        code: 'STUDENT_GIVEN_NAME_MISSING',
        summary: 'Student given name needs review',
        entityType: 'student',
        entityId: student.id,
      })
    if (
      student.enrollments.some((enrollment) => enrollment.schoolId !== schoolId)
    )
      findings.push({
        category: 'student',
        severity: 'blocking',
        code: 'STUDENT_SCHOOL_RELATIONSHIP_INVALID',
        summary: 'Student enrollment school context is inconsistent',
        entityType: 'student',
        entityId: student.id,
      })
  }
  return findings
}
