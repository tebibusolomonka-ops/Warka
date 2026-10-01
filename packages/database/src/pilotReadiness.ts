export const pilotPrerequisites = [
  'primaryContactConfirmed',
  'supportContactConfirmed',
  'academicYearConfigured',
  'schoolStructureConfigured',
  'staffAccessPrepared',
  'dataPreparationComplete',
  'trainingComplete',
  'supportCoverageConfirmed',
] as const

export function missingPilotPrerequisites(facts: Record<string, boolean>) {
  return pilotPrerequisites.filter((item) => facts[item] !== true)
}
