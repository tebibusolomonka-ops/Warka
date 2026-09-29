import type { PrismaClient } from '@warka/database'

export async function reconcileStaleFileScans(
  database: PrismaClient,
  input: { now?: Date; staleAfterMs?: number } = {},
) {
  const now = input.now ?? new Date()
  const staleAfterMs = input.staleAfterMs ?? 300_000
  const cutoff = new Date(now.getTime() - staleAfterMs)
  const stale = await database.fileScan.findMany({
    where: {
      status: 'scanning',
      startedAt: { lte: cutoff },
      fileAsset: { status: 'pending', scanRequired: true },
    },
    select: { id: true, fileAssetId: true, scanner: true },
    take: 100,
  })
  const rescheduled: string[] = []
  for (const scan of stale) {
    const replacement = await database.$transaction(async (transaction) => {
      const interrupted = await transaction.fileScan.updateMany({
        where: { id: scan.id, status: 'scanning' },
        data: {
          status: 'unavailable',
          completedAt: now,
          failureCode: 'WORKER_INTERRUPTED',
        },
      })
      if (interrupted.count !== 1) return null
      const duplicate = await transaction.scheduledTaskExecution.findFirst({
        where: {
          taskType: 'fileScan',
          status: { in: ['pending', 'running'] },
          resourceId: {
            in: (
              await transaction.fileScan.findMany({
                where: { fileAssetId: scan.fileAssetId },
                select: { id: true },
              })
            ).map(({ id }) => id),
          },
        },
        select: { id: true },
      })
      if (duplicate) return null
      const next = await transaction.fileScan.create({
        data: { fileAssetId: scan.fileAssetId, scanner: scan.scanner },
      })
      await transaction.scheduledTaskExecution.create({
        data: {
          taskType: 'fileScan',
          scope: 'file_scan',
          resourceId: next.id,
          scheduledFor: now,
          status: 'pending',
          attempt: 1,
        },
      })
      return next.id
    })
    if (replacement) rescheduled.push(replacement)
  }
  return { detected: stale.length, rescheduled }
}
