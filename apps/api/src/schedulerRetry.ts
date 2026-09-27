export const maxScheduledAttempts = 3

export function retryDelayMs(attempt: number) {
  return 60_000 * 2 ** (attempt - 1)
}

export function retryEligible(
  task: {
    status: string
    attempt: number
    failureCode: string | null
    completedAt: Date | null
  },
  now = new Date(),
) {
  return (
    task.status === 'failed' &&
    task.attempt < maxScheduledAttempts &&
    ['BACKUP_FAILED', 'RETENTION_EVALUATION_FAILED'].includes(
      task.failureCode ?? '',
    ) &&
    !!task.completedAt &&
    now.getTime() - task.completedAt.getTime() >= retryDelayMs(task.attempt)
  )
}
