import {
  assignTrainingRecord,
  completeSchoolOnboarding,
  evaluateSchoolReadiness,
  finishTrainingRecord,
  getSchoolOnboarding,
  listOnboardingChecklist,
  listTrainingRecords,
  pauseSchoolOnboarding,
  startSchoolOnboarding,
  submitSchoolOnboarding,
  updateManualChecklistItem,
  type PrismaClient,
} from '@warka/database'

export function prismaOnboardingService(database: PrismaClient) {
  return {
    state: (actorId: string, schoolId: string) =>
      getSchoolOnboarding(database, actorId, schoolId),
    start: (actorId: string, schoolId: string) =>
      startSchoolOnboarding(database, actorId, schoolId),
    pause: (actorId: string, schoolId: string) =>
      pauseSchoolOnboarding(database, actorId, schoolId),
    checklist: (actorId: string, schoolId: string) =>
      listOnboardingChecklist(database, actorId, schoolId),
    updateManual: (
      actorId: string,
      schoolId: string,
      key: string,
      status: string,
    ) => updateManualChecklistItem(database, actorId, schoolId, key, status),
    readiness: (actorId: string, schoolId: string) =>
      evaluateSchoolReadiness(database, actorId, schoolId),
    training: (actorId: string, schoolId: string) =>
      listTrainingRecords(database, actorId, schoolId),
    assignTraining: (
      actorId: string,
      schoolId: string,
      userId: string,
      trainingType: string,
    ) =>
      assignTrainingRecord(database, actorId, schoolId, userId, trainingType),
    finishTraining: (
      actorId: string,
      schoolId: string,
      recordId: string,
      action: 'completed' | 'waived',
      reason?: string,
    ) =>
      finishTrainingRecord(
        database,
        actorId,
        schoolId,
        recordId,
        action,
        reason,
      ),
    submit: (actorId: string, schoolId: string) =>
      submitSchoolOnboarding(database, actorId, schoolId),
    complete: (actorId: string, schoolId: string) =>
      completeSchoolOnboarding(database, actorId, schoolId),
  }
}
export type OnboardingService = ReturnType<typeof prismaOnboardingService>
