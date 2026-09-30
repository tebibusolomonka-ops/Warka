import { createHash } from 'node:crypto'
import { Prisma, type PrismaClient } from '@prisma/client'
import { z } from 'zod'

const ResultSchema = z.strictObject({
  validRows: z.number().int().nonnegative(),
  invalidRows: z.number().int().nonnegative(),
  warnings: z.array(z.string().max(160)).max(1000),
  possibleDuplicates: z
    .array(
      z.strictObject({
        rowNumber: z.number().int().positive(),
        studentId: z.uuid(),
      }),
    )
    .max(1000),
  unresolvedReferences: z.array(z.string().max(160)).max(1000),
  normalizedRows: z.array(z.record(z.string(), z.unknown())).max(1000),
})
const InputSchema = z.strictObject({
  importJobId: z.uuid(),
  sourceProfileId: z.uuid(),
  fileChecksum: z.string().regex(/^[a-f0-9]{64}$/),
  mapping: z.unknown(),
  transformations: z.unknown(),
  result: ResultSchema,
})
function checksum(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}
export async function createImportDryRun(
  database: PrismaClient,
  input: unknown,
) {
  const data = InputSchema.parse(input)
  return database.$transaction(async (tx) => {
    const latest = await tx.importDryRun.findFirst({
      where: { importJobId: data.importJobId },
      orderBy: { version: 'desc' },
    })
    await tx.importDryRun.updateMany({
      where: {
        importJobId: data.importJobId,
        status: { in: ['successful', 'invalid'] },
      },
      data: { status: 'superseded' },
    })
    return tx.importDryRun.create({
      data: {
        importJobId: data.importJobId,
        version: (latest?.version ?? 0) + 1,
        status: data.result.invalidRows ? 'invalid' : 'successful',
        fileChecksum: data.fileChecksum,
        sourceProfileId: data.sourceProfileId,
        mappingChecksum: checksum(data.mapping),
        transformChecksum: checksum(data.transformations),
        result: data.result as Prisma.InputJsonValue,
      },
    })
  })
}
export const importConfigurationChecksum = checksum
