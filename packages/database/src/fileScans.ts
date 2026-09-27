import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'

export const FileScannerSchema = z.enum(['clamav', 'test'])

export async function createFileScan(
  database: PrismaClient,
  fileAssetId: string,
  scanner: z.input<typeof FileScannerSchema>,
) {
  z.uuid().parse(fileAssetId)
  const name = FileScannerSchema.parse(scanner)
  return database.$transaction(async (transaction) => {
    const asset = await transaction.fileAsset.findUnique({
      where: { id: fileAssetId },
      select: { status: true, scanRequired: true },
    })
    if (!asset || !asset.scanRequired || asset.status !== 'pending')
      throw new Error('File asset is not pending security scan')
    return transaction.fileScan.create({
      data: { fileAssetId, scanner: name, status: 'pending' },
    })
  })
}

export async function latestFileScan(
  database: PrismaClient,
  fileAssetId: string,
) {
  z.uuid().parse(fileAssetId)
  return database.fileScan.findFirst({
    where: { fileAssetId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  })
}
