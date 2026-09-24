import {
  listAcademicYearsForSchool,
  listClassesForAcademicYear,
  listGradeLevelsForSchool,
  type PrismaClient,
} from '@warka/database'
import type { StudentOptions } from '@warka/shared'

export type StudentOptionsService = {
  list(schoolId: string): Promise<StudentOptions>
}

export function prismaStudentOptionsService(
  database: PrismaClient,
): StudentOptionsService {
  return {
    async list(schoolId) {
      const [academicYears, gradeLevels] = await Promise.all([
        listAcademicYearsForSchool(database, schoolId),
        listGradeLevelsForSchool(database, schoolId),
      ])
      const classes = (
        await Promise.all(
          academicYears.map((year) =>
            listClassesForAcademicYear(database, schoolId, year.id),
          ),
        )
      ).flat()
      return {
        academicYears: academicYears.map(({ id, name }) => ({ id, name })),
        gradeLevels: gradeLevels.map(({ id, name }) => ({ id, name })),
        classes: classes.map(({ id, name, gradeLevelId, academicYearId }) => ({
          id,
          name,
          gradeLevelId,
          academicYearId,
        })),
      }
    },
  }
}
