import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { createEnrollment } from './enrollments.js'
import { createExternalRecordReference } from './externalRecordReferences.js'
import { importConfigurationChecksum } from './importDryRuns.js'
import {
  ImportStateError,
  requireSchoolImportPermission,
} from './importJobs.js'
import { readValidatedStudentRows } from './studentImports.js'
import { createStudent } from './students.js'

const ApplySchema = z.strictObject({
  dryRunId: z.uuid(),
  fileChecksum: z.string().regex(/^[a-f0-9]{64}$/),
  mapping: z.unknown(),
  transformations: z.unknown(),
})
export async function applyValidatedImport(
  database: PrismaClient,
  actorUserId: string,
  input: unknown,
) {
  const data = ApplySchema.parse(input)
  const dryRun = await database.importDryRun.findUnique({
    where: { id: data.dryRunId },
    include: { importJob: true },
  })
  if (!dryRun || dryRun.status !== 'successful')
    throw new ImportStateError('Only a successful dry run can be applied')
  await requireSchoolImportPermission(
    database,
    actorUserId,
    dryRun.importJob.schoolId,
  )
  if (
    dryRun.fileChecksum !== data.fileChecksum ||
    dryRun.mappingChecksum !== importConfigurationChecksum(data.mapping) ||
    dryRun.transformChecksum !==
      importConfigurationChecksum(data.transformations)
  )
    throw new ImportStateError('Dry run inputs have changed')
  const result = z.object({ normalizedRows: z.unknown() }).parse(dryRun.result)
  const rows = readValidatedStudentRows(result.normalizedRows)
  return database.$transaction(async (tx) => {
    const claimed = await tx.importDryRun.updateMany({
      where: { id: dryRun.id, status: 'successful' },
      data: { status: 'applied', appliedAt: new Date() },
    })
    if (claimed.count !== 1)
      throw new ImportStateError('Import version was already applied')
    const created = []
    for (const row of rows) {
      const student = await createStudent(tx, {
        givenName: row.givenName,
        ...(row.familyName ? { familyName: row.familyName } : {}),
        ...(row.dateOfBirth ? { dateOfBirth: row.dateOfBirth } : {}),
      })
      const enrollment = await createEnrollment(tx, {
        studentId: student.id,
        schoolId: dryRun.importJob.schoolId,
        academicYearId: row.academicYearId,
        gradeLevelId: row.gradeLevelId,
        ...(row.schoolClassId ? { schoolClassId: row.schoolClassId } : {}),
      })
      if (row.externalStudentId)
        await createExternalRecordReference(tx as PrismaClient, actorUserId, {
          sourceSystem: `profile:${dryRun.sourceProfileId}`,
          externalId: row.externalStudentId,
          entityType: 'student',
          entityId: student.id,
        })
      created.push({ studentId: student.id, enrollmentId: enrollment.id })
    }
    return created
  })
}
