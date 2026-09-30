import { createHash } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { findTransferForSchool } from './transfers.js'

export const WARKA_EXCHANGE_FORMAT = 'warkaExchangePackage'
export const WARKA_EXCHANGE_VERSION = '1.0'
const safeFileName = z
  .string()
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}$/)
  .refine(
    (name) =>
      !name.includes('..') && !name.startsWith('/') && !/^[A-Za-z]:/.test(name),
  )
function digest(content: string) {
  return createHash('sha256').update(content).digest('hex')
}

export async function generateStudentTransferExchange(
  database: PrismaClient,
  actorUserId: string,
  schoolId: string,
  transferId: string,
) {
  const transfer = await findTransferForSchool(
    database,
    actorUserId,
    schoolId,
    transferId,
  )
  if (!transfer || transfer.status !== 'approvedBySendingSchool')
    throw new Error('Approved transfer access required')
  const fileName = safeFileName.parse('student-transfer.json')
  const content = JSON.stringify({
    transferId: transfer.id,
    studentTransferPackage: transfer.transferPackage,
  })
  return {
    manifest: {
      format: WARKA_EXCHANGE_FORMAT,
      version: WARKA_EXCHANGE_VERSION,
      generatedAt: new Date().toISOString(),
      sourceContext: { schoolId },
      exportPurpose: 'studentTransferPackage',
      files: [
        {
          name: fileName,
          checksum: digest(content),
          sizeBytes: Buffer.byteLength(content),
        },
      ],
    },
    files: { [fileName]: content },
  }
}

export function validateExchangeFiles(
  files: Record<string, string>,
  maxFiles = 10,
  maxBytes = 2_000_000,
) {
  const entries = Object.entries(files)
  if (entries.length > maxFiles)
    throw new Error('Exchange package file limit exceeded')
  let bytes = 0
  for (const [name, content] of entries) {
    safeFileName.parse(name)
    bytes += Buffer.byteLength(content)
    if (bytes > maxBytes)
      throw new Error('Exchange package size limit exceeded')
  }
  return true
}
