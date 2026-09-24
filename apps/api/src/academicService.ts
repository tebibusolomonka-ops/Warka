import {
  applyMarkImport,
  assignTeacher,
  correctPublishedResult,
  createAssessment,
  createGradingPeriod,
  createSubject,
  findSchoolMembership,
  getGradingScheme,
  hasOrganizationAdminRole,
  listAcademicYearsForSchool,
  listAssessments,
  listGradingPeriods,
  listPendingResultSets,
  listResultCorrections,
  listSubjectsForSchool,
  listTeacherAssignments,
  mayManageClassSubject,
  previewResults,
  publishResults,
  recordMark,
  saveGradingScheme,
  submitResults,
  updateDraftMark,
  validateMarkImport,
  type AssignTeacher,
  type CreateAssessment,
  type CreateGradingPeriod,
  type CreateSubject,
  type PrismaClient,
  type ResultContext,
  type SaveGradingScheme,
} from '@warka/database'

export class AcademicAccessError extends Error {
  constructor() {
    super('Academic resource not found for this user and school')
  }
}

export function prismaAcademicService(database: PrismaClient) {
  async function access(
    actorId: string,
    schoolId: string,
    mode: 'view' | 'setup',
  ) {
    const school = await database.school.findUnique({
      where: { id: schoolId },
      select: { organizationId: true },
    })
    if (!school) throw new AcademicAccessError()
    if (
      await hasOrganizationAdminRole(database, actorId, school.organizationId)
    )
      return 'administrator'
    const membership = await findSchoolMembership(database, actorId, schoolId)
    if (
      !membership ||
      membership.role === 'registrar' ||
      (mode === 'setup' && membership.role !== 'administrator')
    ) {
      throw new AcademicAccessError()
    }
    return membership.role
  }

  return {
    async structure(actorId: string, schoolId: string) {
      const role = await access(actorId, schoolId, 'view')
      const [academicYears, classes, subjects, gradingPeriods, teachers] =
        await Promise.all([
          listAcademicYearsForSchool(database, schoolId),
          database.schoolClass.findMany({
            where: { schoolId },
            include: { gradeLevel: true },
            orderBy: [{ name: 'asc' }],
          }),
          listSubjectsForSchool(database, schoolId),
          database.gradingPeriod.findMany({
            where: { schoolId },
            orderBy: [{ startsOn: 'asc' }],
          }),
          role === 'administrator'
            ? database.schoolMembership.findMany({
                where: { schoolId, role: { in: ['teacher', 'administrator'] } },
                include: { user: { select: { id: true, displayName: true } } },
              })
            : Promise.resolve([]),
        ])
      return {
        academicYears,
        classes: classes.map((item) => ({
          ...item,
          gradeLevelName: item.gradeLevel.name,
        })),
        subjects,
        gradingPeriods,
        teachers: teachers.map((item) => item.user),
        role,
      }
    },
    async subjects(actorId: string, schoolId: string) {
      await access(actorId, schoolId, 'view')
      return listSubjectsForSchool(database, schoolId)
    },
    async createSubject(actorId: string, input: CreateSubject) {
      await access(actorId, input.schoolId, 'setup')
      return createSubject(database, input)
    },
    async assignments(actorId: string, schoolId: string) {
      const role = await access(actorId, schoolId, 'view')
      if (role === 'administrator') {
        return database.teachingAssignment.findMany({
          where: { schoolId },
          orderBy: [
            { academicYearId: 'asc' },
            { schoolClassId: 'asc' },
            { subjectId: 'asc' },
          ],
        })
      }
      if (role !== 'teacher') return []
      return listTeacherAssignments(database, schoolId, actorId)
    },
    async assignTeacher(actorId: string, input: AssignTeacher) {
      await access(actorId, input.schoolId, 'setup')
      return assignTeacher(database, input)
    },
    async periods(actorId: string, schoolId: string, academicYearId: string) {
      await access(actorId, schoolId, 'view')
      return listGradingPeriods(database, schoolId, academicYearId)
    },
    async createPeriod(actorId: string, input: CreateGradingPeriod) {
      await access(actorId, input.schoolId, 'setup')
      return createGradingPeriod(database, input)
    },
    async assessments(actorId: string, context: ResultContext) {
      const role = await access(actorId, context.schoolId, 'view')
      if (
        role === 'teacher' &&
        !(await mayManageClassSubject(
          database,
          actorId,
          context.schoolId,
          context.academicYearId,
          context.schoolClassId,
          context.subjectId,
        ))
      ) {
        throw new AcademicAccessError()
      }
      return listAssessments(
        database,
        context.schoolId,
        context.academicYearId,
        context.gradingPeriodId,
        context.schoolClassId,
        context.subjectId,
      )
    },
    async createAssessment(actorId: string, input: CreateAssessment) {
      await access(actorId, input.schoolId, 'setup')
      return createAssessment(database, input)
    },
    async scheme(actorId: string, schoolId: string) {
      await access(actorId, schoolId, 'view')
      return getGradingScheme(database, schoolId)
    },
    async saveScheme(actorId: string, input: SaveGradingScheme) {
      await access(actorId, input.schoolId, 'setup')
      return saveGradingScheme(database, input)
    },
    recordMark(actorId: string, input: Parameters<typeof recordMark>[2]) {
      return recordMark(database, actorId, input)
    },
    updateMark(
      actorId: string,
      schoolId: string,
      markId: string,
      score: string,
    ) {
      return updateDraftMark(database, actorId, schoolId, markId, score)
    },
    validateImport(
      actorId: string,
      schoolId: string,
      assessmentId: string,
      csv: string,
    ) {
      return validateMarkImport(database, actorId, schoolId, assessmentId, csv)
    },
    applyImport(
      actorId: string,
      schoolId: string,
      assessmentId: string,
      csv: string,
    ) {
      return applyMarkImport(database, actorId, schoolId, assessmentId, csv)
    },
    preview(actorId: string, context: ResultContext) {
      return previewResults(database, actorId, context)
    },
    submit(actorId: string, context: ResultContext) {
      return submitResults(database, actorId, context)
    },
    pending(actorId: string, schoolId: string) {
      return listPendingResultSets(database, actorId, schoolId)
    },
    publish(actorId: string, schoolId: string, resultSetId: string) {
      return publishResults(database, actorId, schoolId, resultSetId)
    },
    correct(
      actorId: string,
      schoolId: string,
      publishedResultId: string,
      percentage: string,
      reason: string,
    ) {
      return correctPublishedResult(
        database,
        actorId,
        schoolId,
        publishedResultId,
        percentage,
        reason,
      )
    },
    corrections(actorId: string, schoolId: string, publishedResultId: string) {
      return listResultCorrections(
        database,
        actorId,
        schoolId,
        publishedResultId,
      )
    },
  }
}

export type AcademicService = ReturnType<typeof prismaAcademicService>
