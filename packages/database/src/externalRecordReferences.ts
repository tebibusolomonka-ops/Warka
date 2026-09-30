import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'

export const ExternalRecordReferenceInputSchema = z.strictObject({
  sourceSystem: z.string().trim().min(1).max(80),
  externalId: z.string().trim().min(1).max(160),
  entityType: z.enum(['student', 'school', 'staff']),
  entityId: z.uuid(),
})

export async function createExternalRecordReference(
  database: PrismaClient,
  createdById: string,
  input: unknown,
) {
  const data = ExternalRecordReferenceInputSchema.parse(input)
  z.uuid().parse(createdById)
  return database.externalRecordReference.create({
    data: { ...data, createdById },
  })
}

export async function findExternalRecordReference(
  database: PrismaClient,
  sourceSystem: string,
  entityType: 'student' | 'school' | 'staff',
  externalId: string,
) {
  return database.externalRecordReference.findUnique({
    where: {
      sourceSystem_entityType_externalId: {
        sourceSystem: sourceSystem.trim(),
        entityType,
        externalId: externalId.trim(),
      },
    },
  })
}
