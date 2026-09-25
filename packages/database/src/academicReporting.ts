import type { PrismaClient } from '@prisma/client'

export type AcademicOutcomeAggregate = {
  dataState: 'reported'
  publishedResultCount: number
  outcomes: Array<{ gradeLabel: string; count: number }>
}

export function summarizeAcademicOutcomes(
  rows: Array<{ currentGradeLabel: string }>,
): AcademicOutcomeAggregate {
  const groups = new Map<string, number>()
  for (const row of rows)
    groups.set(
      row.currentGradeLabel,
      (groups.get(row.currentGradeLabel) ?? 0) + 1,
    )
  return {
    dataState: 'reported',
    publishedResultCount: rows.length,
    outcomes: [...groups]
      .map(([gradeLabel, count]) => ({ gradeLabel, count }))
      .sort((left, right) => left.gradeLabel.localeCompare(right.gradeLabel)),
  }
}

export async function buildAcademicAggregate(
  database: Pick<PrismaClient, 'publishedResult'>,
  schoolId: string,
  startsOn: Date,
  endsOn: Date,
): Promise<AcademicOutcomeAggregate> {
  const rows = await database.publishedResult.findMany({
    where: {
      schoolId,
      resultSet: {
        status: 'published',
        publishedAt: { gte: startsOn, lte: endsOn },
      },
    },
    select: { currentGradeLabel: true },
  })
  return summarizeAcademicOutcomes(rows)
}
