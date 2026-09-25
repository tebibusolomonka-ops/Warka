import type { PrismaClient } from '@prisma/client'

export type EnrollmentAggregate = {
  dataState: 'reported'
  total: number
  byAcademicYear: Array<{ academicYearId: string; name: string; count: number }>
  byGradeLevel: Array<{ gradeLevelId: string; name: string; count: number }>
}

type EnrollmentRow = {
  academicYear: { id: string; name: string }
  gradeLevel: { id: string; name: string }
}

export function summarizeEnrollmentRows(
  rows: EnrollmentRow[],
): EnrollmentAggregate {
  const academicYears = new Map<string, { name: string; count: number }>()
  const gradeLevels = new Map<string, { name: string; count: number }>()
  for (const row of rows) {
    const year = academicYears.get(row.academicYear.id) ?? {
      name: row.academicYear.name,
      count: 0,
    }
    year.count += 1
    academicYears.set(row.academicYear.id, year)
    const grade = gradeLevels.get(row.gradeLevel.id) ?? {
      name: row.gradeLevel.name,
      count: 0,
    }
    grade.count += 1
    gradeLevels.set(row.gradeLevel.id, grade)
  }
  return {
    dataState: 'reported',
    total: rows.length,
    byAcademicYear: [...academicYears].map(([academicYearId, value]) => ({
      academicYearId,
      ...value,
    })),
    byGradeLevel: [...gradeLevels].map(([gradeLevelId, value]) => ({
      gradeLevelId,
      ...value,
    })),
  }
}

export async function buildEnrollmentAggregate(
  database: Pick<PrismaClient, 'enrollment'>,
  schoolId: string,
  startsOn: Date,
  endsOn: Date,
): Promise<EnrollmentAggregate> {
  const rows = await database.enrollment.findMany({
    where: {
      schoolId,
      status: 'approved',
      approvedAt: { gte: startsOn, lte: endsOn },
    },
    select: {
      academicYear: { select: { id: true, name: true } },
      gradeLevel: { select: { id: true, name: true } },
    },
  })
  return summarizeEnrollmentRows(rows)
}
