import type { PrismaClient } from '@warka/database'
import { heartbeatScheduledTask } from '@warka/database'

export async function withTaskHeartbeat<T>(input: {
  database: PrismaClient
  executionId: string
  workerId: string
  leaseMs?: number
  intervalMs?: number
  active?: () => boolean
  work: () => Promise<T>
}) {
  const leaseMs = input.leaseMs ?? 300_000
  const intervalMs = input.intervalMs ?? 60_000
  if (intervalMs < 1_000 || intervalMs >= leaseMs)
    throw new Error('Invalid task heartbeat interval')
  let ownsLease = true
  let heartbeatRunning = false
  const beat = async () => {
    if (heartbeatRunning || input.active?.() === false) return
    heartbeatRunning = true
    try {
      ownsLease = await heartbeatScheduledTask(
        input.database,
        input.executionId,
        input.workerId,
        { leaseMs },
      )
    } catch {
      ownsLease = false
    } finally {
      heartbeatRunning = false
    }
  }
  const timer = setInterval(() => void beat(), intervalMs)
  timer.unref()
  try {
    const result = await input.work()
    if (!ownsLease) throw new Error('Scheduled task lease lost')
    return result
  } finally {
    clearInterval(timer)
  }
}
